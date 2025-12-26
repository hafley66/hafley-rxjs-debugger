/**
 * Tests for Observable wrapper and tracking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Observable } from '../observable-wrapper';
import { operatorContext, pipeContext, getMetadata } from '../registry';
import { writeQueue$ } from '../storage';
import { map, take } from 'rxjs/operators';

describe('Observable Wrapper', () => {
  beforeEach(() => {
    // Clear any context from previous tests
    while (operatorContext.peek()) {
      operatorContext.pop();
    }
    while (pipeContext.peek()) {
      pipeContext.pop();
    }
  });

  describe('Pipe-time creation (static)', () => {
    it('should register observable metadata', () => {
      const obs$ = new Observable((subscriber) => {
        subscriber.next(1);
        subscriber.complete();
      });

      const metadata = getMetadata(obs$);
      expect(metadata).toBeDefined();
      expect(metadata?.id).toMatch(/^obs#\d+$/);
      expect(metadata?.createdAt).toBeDefined();
      expect(metadata?.location).toBeDefined();
    });

    it('should mark as pipe-time creation (no operator context)', () => {
      const obs$ = new Observable((subscriber) => {
        subscriber.next(1);
      });

      const metadata = getMetadata(obs$);
      expect(metadata?.createdByOperator).toBeUndefined();
      expect(metadata?.triggeredBySubscription).toBeUndefined();
      expect(metadata?.triggeredByObservable).toBeUndefined();
    });

    it('should capture stack trace location', () => {
      const obs$ = new Observable((subscriber) => {
        subscriber.next(1);
      });

      const metadata = getMetadata(obs$);
      expect(metadata?.location.filePath).toBeDefined();
      expect(metadata?.location.line).toBeGreaterThan(0);
      expect(metadata?.location.column).toBeGreaterThan(0);
    });

    it('should queue write to storage', () => {
      const writeSpy = vi.fn();
      const sub = writeQueue$.subscribe(writeSpy);

      const obs$ = new Observable((subscriber) => {
        subscriber.next(1);
      });

      // Wait for next tick to let bufferTime emit
      setTimeout(() => {
        expect(writeSpy).toHaveBeenCalled();
        sub.unsubscribe();
      }, 150);
    });
  });

  describe('Subscribe-time creation (dynamic)', () => {
    it('should mark as subscribe-time when operator context exists', () => {
      // Push operator context (simulating switchMap execution)
      operatorContext.push({
        operatorName: 'switchMap',
        operatorInstanceId: 'op#1',
        subscriptionId: 'sub#1',
        observableId: 'obs#1',
        event: 'next',
        value: 42,
        timestamp: Date.now(),
      });

      const obs$ = new Observable((subscriber) => {
        subscriber.next(1);
      });

      const metadata = getMetadata(obs$);
      expect(metadata?.createdByOperator).toBe('switchMap');
      expect(metadata?.operatorInstanceId).toBe('op#1');
      expect(metadata?.triggeredBySubscription).toBe('sub#1');
      expect(metadata?.triggeredByObservable).toBe('obs#1');
      expect(metadata?.triggeredByEvent).toBe('next');

      operatorContext.pop();
    });

    it('should capture pipe context for grouping', () => {
      pipeContext.push({
        pipeId: 'pipe#5',
        sourceObservableId: 'obs#1',
        operators: [{ name: 'map', position: 0 }],
        startedAt: Date.now(),
      });

      const obs$ = new Observable((subscriber) => {
        subscriber.next(1);
      });

      const metadata = getMetadata(obs$);
      expect(metadata?.pipeGroupId).toBe('pipe#5');

      pipeContext.pop();
    });
  });

  describe('RxJS compatibility', () => {
    it('should work with RxJS operators', async () => {
      const obs$ = new Observable((subscriber) => {
        subscriber.next(1);
        subscriber.next(2);
        subscriber.next(3);
        subscriber.complete();
      });

      const results: number[] = [];
      await new Promise<void>((resolve) => {
        obs$.pipe(map((x) => x * 2)).subscribe({
          next: (val) => results.push(val),
          complete: () => {
            expect(results).toEqual([2, 4, 6]);
            resolve();
          },
        });
      });
    });

    it.skip('should track observables created via operators (requires Task 03 pipe-patch)', () => {
      // This test will pass once we implement Task 03 (pipe patching)
      // Currently, RxJS operators create observables using RxJS Observable, not our wrapper
      const source$ = new Observable((subscriber) => {
        subscriber.next(1);
      });

      const mapped$ = source$.pipe(map((x) => x * 2));

      // Source is tracked (created with our Observable)
      expect(getMetadata(source$)).toBeDefined();
      // Mapped will be tracked after Task 03 pipe-patch
      expect(getMetadata(mapped$)).toBeDefined();
    });

    it('should complete normally', async () => {
      const obs$ = new Observable((subscriber) => {
        subscriber.next(1);
        subscriber.complete();
      });

      await new Promise<void>((resolve) => {
        obs$.subscribe({
          complete: () => {
            expect(true).toBe(true);
            resolve();
          },
        });
      });
    });

    it('should handle errors', async () => {
      const obs$ = new Observable((subscriber) => {
        subscriber.error(new Error('test error'));
      });

      await new Promise<void>((resolve) => {
        obs$.subscribe({
          error: (err) => {
            expect(err.message).toBe('test error');
            resolve();
          },
        });
      });
    });

    it('should support unsubscribe', () => {
      let cleanedUp = false;
      const obs$ = new Observable((subscriber) => {
        return () => {
          cleanedUp = true;
        };
      });

      const sub = obs$.subscribe();
      expect(cleanedUp).toBe(false);

      sub.unsubscribe();
      expect(cleanedUp).toBe(true);
    });
  });

  describe('Context stack nesting', () => {
    it('should handle nested operator contexts', () => {
      // Outer context (e.g., switchMap)
      operatorContext.push({
        operatorName: 'switchMap',
        operatorInstanceId: 'op#1',
        subscriptionId: 'sub#1',
        observableId: 'obs#1',
        event: 'next',
        timestamp: Date.now(),
      });

      // Inner context (e.g., mergeMap inside switchMap)
      operatorContext.push({
        operatorName: 'mergeMap',
        operatorInstanceId: 'op#2',
        subscriptionId: 'sub#2',
        observableId: 'obs#2',
        event: 'next',
        timestamp: Date.now(),
      });

      const obs$ = new Observable((subscriber) => {
        subscriber.next(1);
      });

      const metadata = getMetadata(obs$);
      // Should see the innermost context
      expect(metadata?.createdByOperator).toBe('mergeMap');
      expect(metadata?.operatorInstanceId).toBe('op#2');

      operatorContext.pop();
      operatorContext.pop();
    });

    it('should handle multiple pipe contexts', () => {
      pipeContext.push({
        pipeId: 'pipe#1',
        sourceObservableId: 'obs#1',
        operators: [],
        startedAt: Date.now(),
      });

      pipeContext.push({
        pipeId: 'pipe#2',
        sourceObservableId: 'obs#2',
        operators: [],
        startedAt: Date.now(),
      });

      const obs$ = new Observable((subscriber) => {
        subscriber.next(1);
      });

      const metadata = getMetadata(obs$);
      expect(metadata?.pipeGroupId).toBe('pipe#2');

      pipeContext.pop();
      pipeContext.pop();
    });
  });

  describe('Metadata fields', () => {
    it('should initialize with empty operators array', () => {
      const obs$ = new Observable((subscriber) => {
        subscriber.next(1);
      });

      const metadata = getMetadata(obs$);
      expect(metadata?.operators).toEqual([]);
    });

    it('should initialize with empty path', () => {
      const obs$ = new Observable((subscriber) => {
        subscriber.next(1);
      });

      const metadata = getMetadata(obs$);
      expect(metadata?.path).toBe('');
    });

    it('should generate unique IDs', () => {
      const obs1$ = new Observable((subscriber) => subscriber.next(1));
      const obs2$ = new Observable((subscriber) => subscriber.next(2));

      const meta1 = getMetadata(obs1$);
      const meta2 = getMetadata(obs2$);

      expect(meta1?.id).not.toBe(meta2?.id);
    });
  });
});
