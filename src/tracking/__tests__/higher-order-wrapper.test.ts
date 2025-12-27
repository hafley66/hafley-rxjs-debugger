/**
 * Tests for higher-order operator context wrapping
 *
 * Verifies that operators like switchMap, mergeMap push operatorContext
 * so inner observables created in their project functions get proper metadata.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { of, Observable, Subject } from 'rxjs';
import { take, delay } from 'rxjs/operators';
import {
  switchMap,
  mergeMap,
  concatMap,
  exhaustMap,
  expand,
} from '../higher-order-wrapper';
import {
  observableMetadata,
  resetRegistry,
  operatorContext,
} from '../registry';
import { patchPipe, unpatchPipe } from '../pipe-patch';
import { patchSubscribe, unpatchSubscribe } from '../subscribe-patch';
import { Observable as OObservable } from '../observable-wrapper';

describe('higher-order operator context wrapping', () => {
  beforeEach(() => {
    resetRegistry();
    patchPipe();
    patchSubscribe();
  });

  describe('switchMap', () => {
    it('should mark inner observables with createdByOperator: switchMap', async () => {
      let innerObs: Observable<number> | null = null;

      const source$ = of(1);
      const result$ = source$.pipe(
        switchMap((x) => {
          // Create an observable inside switchMap's project function
          innerObs = new OObservable<number>((subscriber) => {
            subscriber.next(x * 2);
            subscriber.complete();
          });
          return innerObs;
        })
      );

      // Subscribe to trigger execution
      await new Promise<void>((resolve) => {
        result$.subscribe({
          complete: () => resolve(),
        });
      });

      // Inner observable should have switchMap context
      expect(innerObs).not.toBeNull();
      const metadata = observableMetadata.get(innerObs!);
      expect(metadata).toBeDefined();
      expect(metadata?.createdByOperator).toBe('switchMap');
      expect(metadata?.operatorInstanceId).toMatch(/^op#\d+$/);
    });

    it('should link inner observable to correct subscription', async () => {
      let innerObs: Observable<number> | null = null;

      const source$ = of(1);
      const result$ = source$.pipe(
        switchMap((x) => {
          innerObs = new OObservable<number>((subscriber) => {
            subscriber.next(x * 2);
            subscriber.complete();
          });
          return innerObs;
        })
      );

      await new Promise<void>((resolve) => {
        result$.subscribe({ complete: () => resolve() });
      });

      const metadata = observableMetadata.get(innerObs!);
      expect(metadata?.triggeredBySubscription).toMatch(/^sub#\d+$/);
      expect(metadata?.triggeredByObservable).toMatch(/^obs#\d+$/);
    });

    it('should track multiple inner observables from multiple emissions', async () => {
      const innerObservables: Observable<number>[] = [];

      const source$ = of(1, 2, 3);
      const result$ = source$.pipe(
        switchMap((x) => {
          const inner = new OObservable<number>((subscriber) => {
            subscriber.next(x * 2);
            subscriber.complete();
          });
          innerObservables.push(inner);
          return inner;
        })
      );

      await new Promise<void>((resolve) => {
        result$.subscribe({ complete: () => resolve() });
      });

      // Each inner should have switchMap context
      expect(innerObservables.length).toBe(3);
      for (const inner of innerObservables) {
        const metadata = observableMetadata.get(inner);
        expect(metadata?.createdByOperator).toBe('switchMap');
      }
    });
  });

  describe('mergeMap', () => {
    it('should mark inner observables with createdByOperator: mergeMap', async () => {
      let innerObs: Observable<number> | null = null;

      const result$ = of(1).pipe(
        mergeMap((x) => {
          innerObs = new OObservable<number>((subscriber) => {
            subscriber.next(x * 2);
            subscriber.complete();
          });
          return innerObs;
        })
      );

      await new Promise<void>((resolve) => {
        result$.subscribe({ complete: () => resolve() });
      });

      const metadata = observableMetadata.get(innerObs!);
      expect(metadata?.createdByOperator).toBe('mergeMap');
    });
  });

  describe('concatMap', () => {
    it('should mark inner observables with createdByOperator: concatMap', async () => {
      let innerObs: Observable<number> | null = null;

      const result$ = of(1).pipe(
        concatMap((x) => {
          innerObs = new OObservable<number>((subscriber) => {
            subscriber.next(x * 2);
            subscriber.complete();
          });
          return innerObs;
        })
      );

      await new Promise<void>((resolve) => {
        result$.subscribe({ complete: () => resolve() });
      });

      const metadata = observableMetadata.get(innerObs!);
      expect(metadata?.createdByOperator).toBe('concatMap');
    });
  });

  describe('exhaustMap', () => {
    it('should mark inner observables with createdByOperator: exhaustMap', async () => {
      let innerObs: Observable<number> | null = null;

      const result$ = of(1).pipe(
        exhaustMap((x) => {
          innerObs = new OObservable<number>((subscriber) => {
            subscriber.next(x * 2);
            subscriber.complete();
          });
          return innerObs;
        })
      );

      await new Promise<void>((resolve) => {
        result$.subscribe({ complete: () => resolve() });
      });

      const metadata = observableMetadata.get(innerObs!);
      expect(metadata?.createdByOperator).toBe('exhaustMap');
    });
  });

  describe('expand', () => {
    it('should mark inner observables with createdByOperator: expand', async () => {
      const innerObservables: Observable<number>[] = [];

      // expand recursively calls project - use take to limit
      const result$ = of(1).pipe(
        expand((x) => {
          if (x >= 4) {
            return of(); // empty to stop recursion
          }
          const inner = new OObservable<number>((subscriber) => {
            subscriber.next(x * 2);
            subscriber.complete();
          });
          innerObservables.push(inner);
          return inner;
        }),
        take(10) // safety limit
      );

      await new Promise<void>((resolve) => {
        result$.subscribe({ complete: () => resolve() });
      });

      // Should have created inner observables
      expect(innerObservables.length).toBeGreaterThan(0);
      for (const inner of innerObservables) {
        const metadata = observableMetadata.get(inner);
        expect(metadata?.createdByOperator).toBe('expand');
      }
    });
  });

  describe('nested higher-order operators', () => {
    it('should correctly track innermost operator for nested switchMap -> mergeMap', async () => {
      let innermostObs: Observable<number> | null = null;

      const result$ = of(1).pipe(
        switchMap((x) =>
          of(x).pipe(
            mergeMap((y) => {
              innermostObs = new OObservable<number>((subscriber) => {
                subscriber.next(y * 2);
                subscriber.complete();
              });
              return innermostObs;
            })
          )
        )
      );

      await new Promise<void>((resolve) => {
        result$.subscribe({ complete: () => resolve() });
      });

      // The innermost observable should be marked by mergeMap (the closest operator)
      const metadata = observableMetadata.get(innermostObs!);
      expect(metadata?.createdByOperator).toBe('mergeMap');
    });
  });

  describe('context stack management', () => {
    it('should not leak context after project function completes', async () => {
      const result$ = of(1).pipe(
        switchMap((x) => {
          // Context should be set inside project
          const ctx = operatorContext.peek();
          expect(ctx?.operatorName).toBe('switchMap');
          return of(x * 2);
        })
      );

      await new Promise<void>((resolve) => {
        result$.subscribe({ complete: () => resolve() });
      });

      // Context should be cleared after execution
      expect(operatorContext.peek()).toBeUndefined();
    });

    it('should handle errors in project function without leaking context', async () => {
      const result$ = of(1).pipe(
        switchMap((_x) => {
          throw new Error('test error');
        })
      );

      await new Promise<void>((resolve) => {
        result$.subscribe({
          error: () => resolve(),
        });
      });

      // Context should still be cleared even after error
      expect(operatorContext.peek()).toBeUndefined();
    });
  });
});
