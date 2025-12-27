/**
 * Tests for higher-order operator context wrapping
 *
 * Verifies that operators like switchMap, mergeMap push operatorContext
 * so inner observables created in their project functions get proper metadata.
 *
 * IDs are deterministic because resetRegistry() is called in beforeEach.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { of, Observable, Subject } from 'rxjs';
import { take, delay } from 'rxjs/operators';
import { from as patchedFrom } from '../rxjs-patched';
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
    vi.useFakeTimers();
    vi.setSystemTime(0); // 1970-01-01 00:00:00
    resetRegistry();
    patchPipe();
    patchSubscribe();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('switchMap', () => {
    it('should mark inner observables with createdByOperator: switchMap', async () => {
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
      expect(metadata).toMatchSnapshot('inner observable metadata');
    });

    it('should link inner observable to correct subscription', async () => {
      let innerObs: Observable<number> | null = null;

      // of(1) is unpatched so it doesn't get registered
      // result$ (the pipe output) is obs#0, inner is obs#1
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
      expect(metadata?.triggeredBySubscription).toEqual('sub#1');
      expect(metadata?.triggeredByObservable).toEqual('obs#0'); // obs#0 is the piped result (of is unpatched)
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

      expect(innerObservables).toHaveLength(3);

      // All should have same operator context, different IDs
      const metadatas = innerObservables.map(obs => {
        const meta = observableMetadata.get(obs);
        return {
          id: meta?.id,
          createdByOperator: meta?.createdByOperator,
          operatorInstanceId: meta?.operatorInstanceId,
          triggeredByObservable: meta?.triggeredByObservable,
        };
      });
      expect(metadatas).toMatchSnapshot('multiple inner observables metadata');
    });

    it('should link triggeredByObservable to the piped result, not the source', async () => {
      let innerObs: Observable<number> | null = null;

      // Create source - use OObservable to ensure it gets registered
      const source$ = new OObservable<number>((sub) => {
        sub.next(1);
        sub.complete();
      });
      const sourceMeta = observableMetadata.get(source$)!;

      // Create piped result
      const result$ = source$.pipe(
        switchMap((x) => {
          innerObs = new OObservable<number>((subscriber) => {
            subscriber.next(x * 2);
            subscriber.complete();
          });
          return innerObs;
        })
      );
      const resultMeta = observableMetadata.get(result$)!;

      // Deterministic IDs
      expect(sourceMeta.id).toEqual('obs#0');
      expect(resultMeta.id).toEqual('obs#1');

      await new Promise<void>((resolve) => {
        result$.subscribe({ complete: () => resolve() });
      });

      const innerMeta = observableMetadata.get(innerObs!)!;

      // CRITICAL: Inner should link to the RESULT (obs#1), not the SOURCE (obs#0)
      expect(innerMeta.triggeredByObservable).toEqual('obs#1');
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

      const metadata = observableMetadata.get(innerObs!)!;
      expect(metadata.createdByOperator).toEqual('mergeMap');
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

      const metadata = observableMetadata.get(innerObs!)!;
      expect(metadata.createdByOperator).toEqual('concatMap');
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

      const metadata = observableMetadata.get(innerObs!)!;
      expect(metadata.createdByOperator).toEqual('exhaustMap');
    });
  });

  describe('expand', () => {
    it('should mark inner observables with createdByOperator: expand', async () => {
      const innerObservables: Observable<number>[] = [];

      const result$ = of(1).pipe(
        expand((x) => {
          if (x >= 4) return of();
          const inner = new OObservable<number>((subscriber) => {
            subscriber.next(x * 2);
            subscriber.complete();
          });
          innerObservables.push(inner);
          return inner;
        }),
        take(10)
      );

      await new Promise<void>((resolve) => {
        result$.subscribe({ complete: () => resolve() });
      });

      expect(innerObservables).toHaveLength(2); // 1->2, 2->4, 4 stops

      for (const inner of innerObservables) {
        const metadata = observableMetadata.get(inner)!;
        expect(metadata.createdByOperator).toEqual('expand');
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

      // innermost should be marked by mergeMap (the closest operator)
      const metadata = observableMetadata.get(innermostObs!)!;
      expect(metadata.createdByOperator).toEqual('mergeMap');
    });
  });

  describe('patched creation functions inside higher-order operators', () => {
    it('should link from() inside switchMap to parent operator', async () => {
      let innerObs: Observable<number> | null = null;

      // of(1) is unpatched, result$ is obs#0
      const result$ = of(1).pipe(
        switchMap((x) => {
          innerObs = patchedFrom([x * 2]);
          return innerObs;
        })
      );

      await new Promise<void>((resolve) => {
        result$.subscribe({ complete: () => resolve() });
      });

      const metadata = observableMetadata.get(innerObs!)!;
      expect(metadata.createdByOperator).toEqual('switchMap');
      expect(metadata.triggeredByObservable).toEqual('obs#0'); // piped result (of is unpatched)
    });

    it('should link from() inside mergeMap to parent operator', async () => {
      let innerObs: Observable<number> | null = null;

      const result$ = of(1).pipe(
        mergeMap((x) => {
          innerObs = patchedFrom([x * 2]);
          return innerObs;
        })
      );

      await new Promise<void>((resolve) => {
        result$.subscribe({ complete: () => resolve() });
      });

      const metadata = observableMetadata.get(innerObs!)!;
      expect(metadata.createdByOperator).toEqual('mergeMap');
    });

    it('should track multiple from() calls inside switchMap from multiple emissions', async () => {
      const innerObservables: Observable<number>[] = [];

      const result$ = of(1, 2, 3).pipe(
        switchMap((x) => {
          const inner = patchedFrom([x * 2]);
          innerObservables.push(inner);
          return inner;
        })
      );

      await new Promise<void>((resolve) => {
        result$.subscribe({ complete: () => resolve() });
      });

      expect(innerObservables).toHaveLength(3);

      const metadatas = innerObservables.map(obs => {
        const meta = observableMetadata.get(obs)!;
        return {
          id: meta.id,
          createdByOperator: meta.createdByOperator,
          triggeredBySubscription: meta.triggeredBySubscription,
          triggeredByObservable: meta.triggeredByObservable,
        };
      });
      expect(metadatas).toMatchSnapshot('multiple from() calls metadata');
    });

    it('should handle from() in nested higher-order operators', async () => {
      let innermostObs: Observable<number> | null = null;

      const result$ = of(1).pipe(
        switchMap((x) =>
          of(x).pipe(
            mergeMap((y) => {
              innermostObs = patchedFrom([y * 2]);
              return innermostObs;
            })
          )
        )
      );

      await new Promise<void>((resolve) => {
        result$.subscribe({ complete: () => resolve() });
      });

      const metadata = observableMetadata.get(innermostObs!)!;
      expect(metadata.createdByOperator).toEqual('mergeMap');
    });
  });

  describe('context stack management', () => {
    it('should not leak context after project function completes', async () => {
      const result$ = of(1).pipe(
        switchMap((x) => {
          const ctx = operatorContext.peek();
          expect(ctx?.operatorName).toEqual('switchMap');
          return of(x * 2);
        })
      );

      await new Promise<void>((resolve) => {
        result$.subscribe({ complete: () => resolve() });
      });

      expect(operatorContext.peek()).toEqual(undefined);
    });

    it('should handle errors in project function without leaking context', async () => {
      const result$ = of(1).pipe(
        switchMap((_x) => {
          throw new Error('test error');
        })
      );

      await new Promise<void>((resolve) => {
        result$.subscribe({ error: () => resolve() });
      });

      expect(operatorContext.peek()).toEqual(undefined);
    });
  });
});
