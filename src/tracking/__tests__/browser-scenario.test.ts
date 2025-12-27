/**
 * Browser scenario test
 *
 * Mimics how TestApp uses the tracking - importing through operators.ts
 * and rxjs-patched.ts to test the full pipeline.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BehaviorSubject, from } from '../rxjs-patched';
import { switchMap, filter, shareReplay } from '../operators';
import { observableMetadata, resetRegistry } from '../registry';
import { patchPipe } from '../pipe-patch';
import { patchSubscribe } from '../subscribe-patch';

describe('browser scenario - TestApp pattern', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    resetRegistry();
    patchPipe();
    patchSubscribe();
  });

  it('should track from() inside switchMap with createdByOperator', async () => {
    // Mimic TestApp pattern exactly
    const session$ = new BehaviorSubject<{ id: number } | null>(null);

    let innerFromObs: any = null;

    const userProfile$ = session$.pipe(
      filter((user): user is { id: number } => user !== null),
      switchMap(user => {
        innerFromObs = from(Promise.resolve({ ...user, name: 'Test' }));
        return innerFromObs;
      }),
      shareReplay(1)
    );

    // Subscribe and trigger
    const values: any[] = [];
    userProfile$.subscribe(v => values.push(v));

    // Trigger the switchMap by emitting a user
    session$.next({ id: 1 });

    // Let promise resolve
    await vi.runAllTimersAsync();

    const innerMeta = observableMetadata.get(innerFromObs);
    expect(innerMeta).toBeDefined();
    expect(innerMeta?.createdByOperator).toEqual('switchMap');

    // Inner observable should have variableName from callerInfo and no operators
    expect(innerMeta?.variableName).toEqual('from');
    expect(innerMeta?.operators).toEqual([]);
  });

  it('should track multiple inner observables from multiple emissions', async () => {
    const trigger$ = new BehaviorSubject<number>(0);
    const innerObservables: any[] = [];

    const result$ = trigger$.pipe(
      filter(n => n > 0),
      switchMap(n => {
        const inner = from(Promise.resolve(n * 10));
        innerObservables.push(inner);
        return inner;
      })
    );

    result$.subscribe();

    trigger$.next(1);
    await vi.runAllTimersAsync();

    trigger$.next(2);
    await vi.runAllTimersAsync();

    trigger$.next(3);
    await vi.runAllTimersAsync();

    expect(innerObservables).toHaveLength(3);

    for (const inner of innerObservables) {
      const meta = observableMetadata.get(inner);
      expect(meta?.createdByOperator).toEqual('switchMap');
    }
  });
});
