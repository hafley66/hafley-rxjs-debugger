import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { of, Subject, BehaviorSubject, throwError } from 'rxjs';
import {
  patchSubscribe,
  unpatchSubscribe,
  isSubscribePatched,
  getCurrentSubscriptionContext,
  getCurrentSubscriptionId,
  cleanupArchivedSubscriptions,
} from '../subscribe-patch';
import {
  activeSubscriptions,
  archivedSubscriptions,
  clearArchivedSubscriptions,
} from '../registry';
import { patchPipe, unpatchPipe } from '../pipe-patch';
import { map, switchMap, take } from '../operators';

describe('subscribe-patch', () => {
  beforeEach(() => {
    // Clean state
    unpatchSubscribe();
    unpatchPipe();
    activeSubscriptions.clear();
    clearArchivedSubscriptions();
    // Apply patches
    patchPipe();
    patchSubscribe();
  });

  afterEach(() => {
    unpatchSubscribe();
    unpatchPipe();
    activeSubscriptions.clear();
    clearArchivedSubscriptions();
  });

  describe('patchSubscribe / unpatchSubscribe', () => {
    it('should patch Observable.prototype.subscribe', () => {
      expect(isSubscribePatched()).toBe(true);
    });

    it('should unpatch Observable.prototype.subscribe', () => {
      unpatchSubscribe();
      expect(isSubscribePatched()).toBe(false);
    });

    it('should be idempotent', () => {
      patchSubscribe(); // Already patched
      expect(isSubscribePatched()).toBe(true);
      unpatchSubscribe();
      expect(isSubscribePatched()).toBe(false);
    });
  });

  describe('subscription tracking', () => {
    it('should track active subscription', () => {
      const subject = new Subject<number>();
      const sub = subject.subscribe();

      expect(activeSubscriptions.size).toBe(1);
      const [meta] = activeSubscriptions.values();
      expect(meta.subscribedAt).toBeLessThanOrEqual(Date.now());

      sub.unsubscribe();
    });

    it('should generate unique subscription IDs', () => {
      const subject = new Subject<number>();
      const sub1 = subject.subscribe();
      const sub2 = subject.subscribe();

      const ids = Array.from(activeSubscriptions.keys());
      expect(ids.length).toBe(2);
      expect(ids[0]).not.toBe(ids[1]);
      expect(ids[0]).toMatch(/^sub#\d+$/);
      expect(ids[1]).toMatch(/^sub#\d+$/);

      sub1.unsubscribe();
      sub2.unsubscribe();
    });

    it('should link subscription to observable ID', () => {
      const subject = new Subject<number>();
      const sub = subject.subscribe();

      const [meta] = activeSubscriptions.values();
      expect(meta.observableId).toBeDefined();

      sub.unsubscribe();
    });

    it('should handle multiple subscriptions to same observable', () => {
      const subject = new Subject<number>();
      const sub1 = subject.subscribe();
      const sub2 = subject.subscribe();
      const sub3 = subject.subscribe();

      expect(activeSubscriptions.size).toBe(3);

      sub1.unsubscribe();
      sub2.unsubscribe();
      sub3.unsubscribe();
    });
  });

  describe('unsubscribe tracking', () => {
    it('should move subscription to archive on unsubscribe', () => {
      // Use Subject because of() completes synchronously and archives immediately
      const subject = new Subject<number>();
      const sub = subject.subscribe();
      const subId = Array.from(activeSubscriptions.keys())[0];

      expect(activeSubscriptions.has(subId)).toBe(true);
      expect(archivedSubscriptions.has(subId)).toBe(false);

      sub.unsubscribe();

      expect(activeSubscriptions.has(subId)).toBe(false);
      expect(archivedSubscriptions.has(subId)).toBe(true);
    });

    it('should record unsubscribedAt timestamp', () => {
      const subject = new Subject<number>();
      const sub = subject.subscribe();
      const subId = Array.from(activeSubscriptions.keys())[0];

      const beforeUnsubscribe = Date.now();
      sub.unsubscribe();
      const afterUnsubscribe = Date.now();

      const meta = archivedSubscriptions.get(subId);
      expect(meta?.unsubscribedAt).toBeGreaterThanOrEqual(beforeUnsubscribe);
      expect(meta?.unsubscribedAt).toBeLessThanOrEqual(afterUnsubscribe);
    });

    it('should handle multiple unsubscribe calls gracefully', () => {
      const subject = new Subject<number>();
      const sub = subject.subscribe();
      const subId = Array.from(activeSubscriptions.keys())[0];

      sub.unsubscribe();
      sub.unsubscribe(); // Should not throw
      sub.unsubscribe();

      expect(archivedSubscriptions.has(subId)).toBe(true);
    });

    it('should immediately archive sync observables like of()', () => {
      // of() completes synchronously, so subscription is archived immediately
      of(1).subscribe();

      expect(activeSubscriptions.size).toBe(0);
      expect(archivedSubscriptions.size).toBe(1);
    });
  });

  describe('parent-child relationships', () => {
    it('should track parent-child when subscribing inside callback', async () => {
      const outer$ = of(1);
      const inner$ = of(2);

      await new Promise<void>((resolve) => {
        outer$.subscribe(() => {
          const outerSubId = Array.from(activeSubscriptions.keys())[0];

          inner$.subscribe(() => {
            const innerSubId = Array.from(activeSubscriptions.keys()).find(
              (id) => id !== outerSubId
            );

            const innerMeta = activeSubscriptions.get(innerSubId!);
            expect(innerMeta?.parentSubscriptionId).toBe(outerSubId);

            const outerMeta = activeSubscriptions.get(outerSubId);
            expect(outerMeta?.childSubscriptionIds).toContain(innerSubId);

            resolve();
          });
        });
      });
    });

    it('should track depth correctly', async () => {
      const a$ = of(1);
      const b$ = of(2);
      const c$ = of(3);

      await new Promise<void>((resolve) => {
        a$.subscribe(() => {
          b$.subscribe(() => {
            c$.subscribe(() => {
              // Get all subscription metas
              const metas = Array.from(activeSubscriptions.values());
              const depths = metas.map((m) => {
                // Count parent chain to determine depth
                let depth = 0;
                let current = m;
                while (current.parentSubscriptionId) {
                  depth++;
                  current = activeSubscriptions.get(current.parentSubscriptionId)!;
                }
                return depth;
              });

              expect(depths.sort()).toEqual([0, 1, 2]);
              resolve();
            });
          });
        });
      });
    });

    it('should handle switchMap parent-child relationships', async () => {
      const source$ = of(1, 2);

      await new Promise<void>((resolve) => {
        let emitCount = 0;

        source$
          .pipe(switchMap((x) => of(x * 2)))
          .subscribe({
            next: () => {
              emitCount++;
            },
            complete: () => {
              // Should have tracked subscriptions
              expect(activeSubscriptions.size + archivedSubscriptions.size).toBeGreaterThan(0);
              resolve();
            },
          });
      });
    });
  });

  describe('context stack', () => {
    it('should return undefined when no subscription active', () => {
      expect(getCurrentSubscriptionContext()).toBeUndefined();
      expect(getCurrentSubscriptionId()).toBeUndefined();
    });

    it('should provide context during subscription callback', async () => {
      await new Promise<void>((resolve) => {
        of(1).subscribe(() => {
          const ctx = getCurrentSubscriptionContext();
          expect(ctx).toBeDefined();
          expect(ctx?.subscriptionId).toMatch(/^sub#\d+$/);
          expect(ctx?.depth).toBe(0);
          resolve();
        });
      });
    });

    it('should update context for nested subscriptions', async () => {
      await new Promise<void>((resolve) => {
        of(1).subscribe(() => {
          const outerCtx = getCurrentSubscriptionContext();
          expect(outerCtx?.depth).toBe(0);

          of(2).subscribe(() => {
            const innerCtx = getCurrentSubscriptionContext();
            expect(innerCtx?.depth).toBe(1);
            expect(innerCtx?.parentSubscriptionId).toBe(outerCtx?.subscriptionId);
            resolve();
          });
        });
      });
    });

    it('should properly pop context after subscription completes', async () => {
      await new Promise<void>((resolve) => {
        of(1).subscribe({
          complete: () => {
            // Context should still be available in complete callback
            // but will be popped after
          },
        });

        // After synchronous subscription completes, context should be cleared
        expect(getCurrentSubscriptionContext()).toBeUndefined();
        resolve();
      });
    });
  });

  describe('observer wrapping', () => {
    it('should call original next callback', async () => {
      const values: number[] = [];

      await new Promise<void>((resolve) => {
        of(1, 2, 3).subscribe({
          next: (v) => values.push(v),
          complete: () => {
            expect(values).toEqual([1, 2, 3]);
            resolve();
          },
        });
      });
    });

    it('should call original error callback', async () => {
      const error = new Error('test error');

      await new Promise<void>((resolve) => {
        throwError(() => error).subscribe({
          error: (e) => {
            expect(e).toBe(error);
            resolve();
          },
        });
      });
    });

    it('should call original complete callback', async () => {
      await new Promise<void>((resolve) => {
        of(1).subscribe({
          complete: () => {
            resolve();
          },
        });
      });
    });

    it('should work with function arguments instead of observer', async () => {
      const values: number[] = [];

      await new Promise<void>((resolve) => {
        of(1, 2, 3).subscribe(
          (v) => values.push(v),
          () => {},
          () => {
            expect(values).toEqual([1, 2, 3]);
            resolve();
          }
        );
      });
    });
  });

  describe('Subject and BehaviorSubject', () => {
    it('should track Subject subscriptions', () => {
      const subject = new Subject<number>();
      const sub = subject.subscribe();

      expect(activeSubscriptions.size).toBe(1);

      sub.unsubscribe();
    });

    it('should track BehaviorSubject subscriptions', () => {
      const subject = new BehaviorSubject<number>(0);
      const sub = subject.subscribe();

      expect(activeSubscriptions.size).toBe(1);

      sub.unsubscribe();
    });

    it('should track multiple subscribers to same Subject', () => {
      const subject = new Subject<number>();
      const sub1 = subject.subscribe();
      const sub2 = subject.subscribe();
      const sub3 = subject.subscribe();

      expect(activeSubscriptions.size).toBe(3);

      sub1.unsubscribe();
      sub2.unsubscribe();
      sub3.unsubscribe();
    });
  });

  describe('archive cleanup', () => {
    it('should clean up old archived subscriptions', () => {
      // Create and unsubscribe several
      for (let i = 0; i < 5; i++) {
        const sub = of(i).subscribe();
        sub.unsubscribe();
      }

      expect(archivedSubscriptions.size).toBe(5);

      // Manually set old timestamps
      for (const meta of archivedSubscriptions.values()) {
        meta.unsubscribedAt = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      }

      cleanupArchivedSubscriptions();

      expect(archivedSubscriptions.size).toBe(0);
    });

    it('should enforce max archived subscriptions', () => {
      // Create many subscriptions
      for (let i = 0; i < 1100; i++) {
        const sub = of(i).subscribe();
        sub.unsubscribe();
      }

      expect(archivedSubscriptions.size).toBe(1100);

      cleanupArchivedSubscriptions();

      expect(archivedSubscriptions.size).toBeLessThanOrEqual(1000);
    });
  });
});
