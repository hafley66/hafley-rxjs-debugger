import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { of, interval, Subject } from 'rxjs';
// Use our decorated operators for proper name tracking
import { map, filter, take, tap, switchMap, delay } from '../operators';
import {
  patchPipe,
  unpatchPipe,
  isPipePatched,
  getOperatorName,
  annotateOperator,
} from '../pipe-patch';
import { getMetadata } from '../registry';

describe('pipe-patch', () => {
  beforeEach(() => {
    // Ensure we start clean
    unpatchPipe();
    // Apply patch for tests
    patchPipe();
  });

  afterEach(() => {
    // Clean up after each test
    unpatchPipe();
  });

  describe('patchPipe / unpatchPipe', () => {
    it('should patch Observable.prototype.pipe', () => {
      expect(isPipePatched()).toBe(true);
    });

    it('should unpatch Observable.prototype.pipe', () => {
      unpatchPipe();
      expect(isPipePatched()).toBe(false);
    });

    it('should be idempotent - calling patchPipe twice does not double-patch', () => {
      patchPipe(); // Already patched, should be no-op
      expect(isPipePatched()).toBe(true);
      unpatchPipe();
      expect(isPipePatched()).toBe(false);
    });
  });

  describe('operator chain capture', () => {
    it('should capture single operator', () => {
      const source$ = of(1, 2, 3);
      const result$ = source$.pipe(map((x) => x * 2));

      const meta = getMetadata(result$);
      expect(meta).toBeDefined();
      expect(meta!.operators).toEqual(['map']);
    });

    it('should capture multiple operators', () => {
      const source$ = of(1, 2, 3, 4, 5);
      const result$ = source$.pipe(
        map((x) => x * 2),
        filter((x) => x > 4),
        take(2)
      );

      const meta = getMetadata(result$);
      expect(meta).toBeDefined();
      expect(meta!.operators).toEqual(['map', 'filter', 'take']);
    });

    it('should handle empty pipe', () => {
      const source$ = of(1, 2, 3);
      const result$ = source$.pipe();

      const meta = getMetadata(result$);
      expect(meta).toBeDefined();
      expect(meta!.operators).toEqual([]);
    });

    it('should capture tap operator', () => {
      const source$ = of(1);
      const result$ = source$.pipe(
        tap((x) => console.log(x)),
        map((x) => x + 1)
      );

      const meta = getMetadata(result$);
      expect(meta!.operators).toEqual(['tap', 'map']);
    });
  });

  describe('parent-child relationships', () => {
    it('should set parent reference', () => {
      const source$ = of(1, 2, 3);
      const result$ = source$.pipe(map((x) => x * 2));

      const meta = getMetadata(result$);
      expect(meta).toBeDefined();
      expect(meta!.parent).toBeDefined();
      expect(meta!.parent!.deref()).toBe(source$);
    });

    it('should chain parent references through multiple pipes', () => {
      const source$ = of(1, 2, 3);
      const first$ = source$.pipe(map((x) => x * 2));
      const second$ = first$.pipe(filter((x) => x > 2));
      const third$ = second$.pipe(take(1));

      const firstMeta = getMetadata(first$);
      const secondMeta = getMetadata(second$);
      const thirdMeta = getMetadata(third$);

      expect(firstMeta!.parent!.deref()).toBe(source$);
      expect(secondMeta!.parent!.deref()).toBe(first$);
      expect(thirdMeta!.parent!.deref()).toBe(second$);
    });

    it('should use WeakRef for parent (allows GC)', () => {
      const source$ = of(1, 2, 3);
      const result$ = source$.pipe(map((x) => x * 2));

      const meta = getMetadata(result$);
      expect(meta!.parent).toBeInstanceOf(WeakRef);
    });
  });

  describe('path generation', () => {
    it('should generate path based on operator count', () => {
      const source$ = of(1, 2, 3);
      const result$ = source$.pipe(
        map((x) => x * 2),
        filter((x) => x > 2)
      );

      const meta = getMetadata(result$);
      expect(meta!.path).toBe('2'); // 2 operators
    });

    it('should generate nested path for chained pipes', () => {
      const source$ = of(1, 2, 3);

      // First pipe: 2 operators -> path "2"
      const first$ = source$.pipe(
        map((x) => x * 2),
        filter((x) => x > 2)
      );

      // Second pipe: 1 operator -> path "2.1"
      const second$ = first$.pipe(take(1));

      const firstMeta = getMetadata(first$);
      const secondMeta = getMetadata(second$);

      expect(firstMeta!.path).toBe('2');
      expect(secondMeta!.path).toBe('2.1');
    });

    it('should handle deep nesting', () => {
      const source$ = of(1);
      const a$ = source$.pipe(map((x) => x)); // path: "1"
      const b$ = a$.pipe(map((x) => x), map((x) => x)); // path: "1.2"
      const c$ = b$.pipe(map((x) => x)); // path: "1.2.1"

      expect(getMetadata(a$)!.path).toBe('1');
      expect(getMetadata(b$)!.path).toBe('1.2');
      expect(getMetadata(c$)!.path).toBe('1.2.1');
    });

    it('should handle empty pipe (0 operators)', () => {
      const source$ = of(1);
      const result$ = source$.pipe();

      const meta = getMetadata(result$);
      expect(meta!.path).toBe('0');
    });
  });

  describe('pipeGroupId', () => {
    it('should assign pipeGroupId to piped observables', () => {
      const source$ = of(1);
      const result$ = source$.pipe(map((x) => x * 2));

      const meta = getMetadata(result$);
      expect(meta!.pipeGroupId).toBeDefined();
      expect(meta!.pipeGroupId).toMatch(/^pipe#\d+$/);
    });

    it('should assign different pipeGroupIds to different pipe calls', () => {
      const source$ = of(1);
      const first$ = source$.pipe(map((x) => x * 2));
      const second$ = source$.pipe(filter((x) => x > 0));

      const firstMeta = getMetadata(first$);
      const secondMeta = getMetadata(second$);

      expect(firstMeta!.pipeGroupId).not.toBe(secondMeta!.pipeGroupId);
    });
  });

  describe('getOperatorName', () => {
    it('should extract name from named function', () => {
      function myOperator() {}
      expect(getOperatorName(myOperator)).toBe('myOperator');
    });

    it('should return "unknown" for null/undefined', () => {
      expect(getOperatorName(null)).toBe('unknown');
      expect(getOperatorName(undefined)).toBe('unknown');
    });

    it('should return function name for arrow functions assigned to variables', () => {
      const anonFn = () => {};
      // JS infers name from variable assignment
      expect(getOperatorName(anonFn)).toBe('anonFn');
    });

    it('should return "operator" for truly anonymous functions', () => {
      // Immediately invoked or inline - no name inference
      expect(getOperatorName((() => {}))).toBe('operator');
    });

    it('should use __operatorName annotation if present', () => {
      const op = () => {};
      (op as any).__operatorName = 'customName';
      expect(getOperatorName(op)).toBe('customName');
    });
  });

  describe('annotateOperator', () => {
    it('should annotate operator with custom name', () => {
      const op = map((x: number) => x * 2);
      const annotated = annotateOperator(op, 'doubler');

      expect(getOperatorName(annotated)).toBe('doubler');
    });

    it('should return same operator reference', () => {
      const op = map((x: number) => x * 2);
      const annotated = annotateOperator(op, 'doubler');

      expect(annotated).toBe(op);
    });
  });

  describe('real-world scenarios', () => {
    it('should work with Subject', () => {
      const subject$ = new Subject<number>();
      const result$ = subject$.pipe(
        map((x) => x * 2),
        filter((x) => x > 5)
      );

      const meta = getMetadata(result$);
      expect(meta).toBeDefined();
      expect(meta!.operators).toEqual(['map', 'filter']);
    });

    it('should work with interval (creation function)', () => {
      const source$ = interval(1000);
      const result$ = source$.pipe(take(5), map((x) => x * 2));

      const meta = getMetadata(result$);
      expect(meta).toBeDefined();
      expect(meta!.operators).toEqual(['take', 'map']);
    });

    it('should handle branching from same source', () => {
      const source$ = of(1, 2, 3);
      const branch1$ = source$.pipe(map((x) => x * 2));
      const branch2$ = source$.pipe(map((x) => x + 1));
      const branch3$ = source$.pipe(filter((x) => x > 1));

      const meta1 = getMetadata(branch1$);
      const meta2 = getMetadata(branch2$);
      const meta3 = getMetadata(branch3$);

      // All should have source$ as parent
      expect(meta1!.parent!.deref()).toBe(source$);
      expect(meta2!.parent!.deref()).toBe(source$);
      expect(meta3!.parent!.deref()).toBe(source$);

      // All should have path "1" (single operator from source)
      expect(meta1!.path).toBe('1');
      expect(meta2!.path).toBe('1');
      expect(meta3!.path).toBe('1');

      // All should have different IDs
      expect(meta1!.id).not.toBe(meta2!.id);
      expect(meta2!.id).not.toBe(meta3!.id);
    });
  });
});
