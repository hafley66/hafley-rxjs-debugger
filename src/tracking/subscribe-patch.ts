/**
 * Subscribe Patching for RxJS Devtools
 *
 * Monkey-patches Observable.prototype.subscribe to track:
 * - Subscription lifecycle (subscribe -> unsubscribe)
 * - Parent-child relationships (nested subscriptions)
 * - Emissions, errors, and completions (when tracking enabled)
 *
 * This is SUBSCRIBE-TIME tracking. Pipe-time tracking is handled by pipe-patch.ts.
 */

import { Observable, Subscription, interval } from 'rxjs';
import type { Observer } from 'rxjs';
import {
  activeSubscriptions,
  archivedSubscriptions,
  archiveSubscription,
  generateSubscriptionId,
  ensureObservableRegistered,
  subscriptionContext,
  registerSubscription,
  recordEmission,
  recordError,
  generateEmissionId,
  generateErrorId,
} from './registry';
import { writeQueue$ } from './storage';
import { trackingConfig$ } from './config';
import type { SubscriptionMetadata, SubscriptionContext, Emission, ErrorEvent } from './types';

// Store originals
let originalSubscribe: typeof Observable.prototype.subscribe | null = null;
let originalUnsubscribe: typeof Subscription.prototype.unsubscribe | null = null;

// Track if we're patched
let isPatched = false;

// Symbol to store tracking ID on subscription instances
const TRACKING_ID = Symbol('rxjs-devtools-sub-id');

// Current config (subscribed reactively)
let currentConfig = trackingConfig$.getValue();
trackingConfig$.subscribe((config) => {
  currentConfig = config;
});

/**
 * Patch Observable.prototype.subscribe and Subscription.prototype.unsubscribe
 */
export function patchSubscribe(): void {
  if (isPatched) return;

  // Patch Subscription.prototype.unsubscribe globally
  originalUnsubscribe = Subscription.prototype.unsubscribe;
  Subscription.prototype.unsubscribe = function patchedUnsubscribe(this: Subscription) {
    const subId = (this as any)[TRACKING_ID];
    if (subId) {
      archiveSubscription(subId);
    }
    return originalUnsubscribe!.call(this);
  };

  originalSubscribe = Observable.prototype.subscribe;

  Observable.prototype.subscribe = function patchedSubscribe(
    this: Observable<any>,
    observerOrNext?: Partial<Observer<any>> | ((value: any) => void) | null,
    error?: ((error: any) => void) | null,
    complete?: (() => void) | null
  ): Subscription {
    // Generate ID for this subscription
    const subId = generateSubscriptionId();

    // Get or lazily create observable metadata
    const obsMeta = ensureObservableRegistered(this);
    const obsId = obsMeta.id;

    // Detect parent subscription from context stack
    const parentCtx = subscriptionContext.peek();
    const parentSubId = parentCtx?.subscriptionId;
    const depth = parentCtx ? parentCtx.depth + 1 : 0;

    // Create subscription metadata
    const subMeta: SubscriptionMetadata = {
      id: subId,
      observableId: obsId,
      subscribedAt: Date.now(),
      parentSubscriptionId: parentSubId,
      childSubscriptionIds: [],
      triggeredByObservableId: parentCtx?.observableId,
      emissionIds: [],
      errorIds: [],
    };

    // Register in active subscriptions
    registerSubscription(subMeta);

    // Add to parent's children list
    if (parentSubId) {
      const parentMeta = activeSubscriptions.get(parentSubId);
      if (parentMeta) {
        parentMeta.childSubscriptionIds.push(subId);
      }
    }

    // Push context before calling original
    const ctx: SubscriptionContext = {
      subscriptionId: subId,
      observableId: obsId,
      parentSubscriptionId: parentSubId,
      depth,
    };
    subscriptionContext.push(ctx);

    // Wrap observer to track emissions/errors/completions
    const wrappedObserver = wrapObserver(
      subId,
      obsId,
      observerOrNext,
      error,
      complete
    );

    // Call original subscribe
    let subscription: Subscription;
    try {
      subscription = (originalSubscribe as Function).call(this, wrappedObserver);
    } finally {
      // Always pop, even if error
      subscriptionContext.pop();
    }

    // Store tracking ID on subscription for global unsubscribe tracking
    (subscription as any)[TRACKING_ID] = subId;

    // Also set on the passed-in observer if it's a Subscription (for share() internal handling)
    // share() creates a SafeSubscriber and passes it to subscribe, then calls unsubscribe on that
    if (observerOrNext && typeof observerOrNext === 'object' && observerOrNext instanceof Subscription) {
      (observerOrNext as any)[TRACKING_ID] = subId;
    }

    // Register teardown to archive subscription on unsubscribe
    // This works for both sync (of, from) and async observables
    // Must be added AFTER subscribe returns for sync observables
    if (!subscription.closed) {
      subscription.add(() => {
        archiveSubscription(subId);
      });
    } else {
      // Subscription already closed (sync observable like of())
      // Archive immediately
      archiveSubscription(subId);
    }

    // Write to storage
    writeQueue$.next({
      store: 'subscriptions',
      key: subId,
      data: subMeta,
    });

    return subscription;
  };

  isPatched = true;
}

/**
 * Wrap observer to track emissions, errors, and completions
 */
function wrapObserver(
  subId: string,
  obsId: string,
  observerOrNext?: Partial<Observer<any>> | ((value: any) => void) | null,
  errorFn?: ((error: any) => void) | null,
  completeFn?: (() => void) | null
): Partial<Observer<any>> {
  // Normalize to observer object
  let originalNext: ((value: any) => void) | undefined;
  let originalError: ((error: any) => void) | undefined;
  let originalComplete: (() => void) | undefined;

  if (typeof observerOrNext === 'function') {
    originalNext = observerOrNext;
    originalError = errorFn || undefined;
    originalComplete = completeFn || undefined;
  } else if (observerOrNext) {
    originalNext = observerOrNext.next?.bind(observerOrNext);
    originalError = observerOrNext.error?.bind(observerOrNext);
    originalComplete = observerOrNext.complete?.bind(observerOrNext);
  }

  return {
    next: (value: any) => {
      // Track emission if enabled
      if (currentConfig.enabled && currentConfig.trackEmissions) {
        const emission: Emission = {
          id: generateEmissionId(),
          subscriptionId: subId,
          observableId: obsId,
          value,
          timestamp: Date.now(),
        };
        recordEmission(emission);
      }
      originalNext?.(value);
    },
    error: (err: any) => {
      // Track error if enabled
      if (currentConfig.enabled && currentConfig.trackErrors) {
        const errorEvent: ErrorEvent = {
          id: generateErrorId(),
          subscriptionId: subId,
          observableId: obsId,
          error: err,
          timestamp: Date.now(),
        };
        recordError(errorEvent);
      }
      originalError?.(err);
    },
    complete: () => {
      // Track completion if enabled
      if (currentConfig.enabled && currentConfig.trackCompletions) {
        const meta = activeSubscriptions.get(subId);
        if (meta) {
          meta.completedAt = Date.now();
        }
      }
      originalComplete?.();
    },
  };
}

/**
 * Restore originals
 */
export function unpatchSubscribe(): void {
  if (!isPatched) return;

  if (originalSubscribe) {
    Observable.prototype.subscribe = originalSubscribe;
    originalSubscribe = null;
  }

  if (originalUnsubscribe) {
    Subscription.prototype.unsubscribe = originalUnsubscribe;
    originalUnsubscribe = null;
  }

  isPatched = false;
}

/**
 * Check if subscribe is currently patched
 */
export function isSubscribePatched(): boolean {
  return isPatched;
}

/**
 * Get current subscription context (top of stack)
 */
export function getCurrentSubscriptionContext(): SubscriptionContext | undefined {
  return subscriptionContext.peek();
}

/**
 * Get current subscription ID (convenience helper)
 */
export function getCurrentSubscriptionId(): string | undefined {
  return subscriptionContext.peek()?.subscriptionId;
}

// === Archive Cleanup ===

const MAX_ARCHIVED_SUBSCRIPTIONS = 1000;
const MAX_ARCHIVE_AGE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Clean up old archived subscriptions to prevent memory growth
 */
export function cleanupArchivedSubscriptions(): void {
  const now = Date.now();
  const toDelete: string[] = [];

  for (const [id, meta] of archivedSubscriptions.entries()) {
    if (meta.unsubscribedAt && now - meta.unsubscribedAt > MAX_ARCHIVE_AGE_MS) {
      toDelete.push(id);
    }
  }

  // Enforce max size (remove oldest first)
  if (archivedSubscriptions.size - toDelete.length > MAX_ARCHIVED_SUBSCRIPTIONS) {
    const entries = Array.from(archivedSubscriptions.entries())
      .filter(([id]) => !toDelete.includes(id))
      .sort((a, b) => (a[1].unsubscribedAt || 0) - (b[1].unsubscribedAt || 0));

    const excess = entries.length - MAX_ARCHIVED_SUBSCRIPTIONS;
    if (excess > 0) {
      entries.slice(0, excess).forEach(([id]) => toDelete.push(id));
    }
  }

  toDelete.forEach((id) => archivedSubscriptions.delete(id));
}

// Auto-cleanup subscription using RxJS
let cleanupSubscription: Subscription | null = null;

export function startAutoCleanup(): void {
  if (cleanupSubscription) return;
  // Use RxJS interval for cleanup every 60 seconds
  cleanupSubscription = interval(60_000).subscribe(() => {
    cleanupArchivedSubscriptions();
  });
}

export function stopAutoCleanup(): void {
  if (cleanupSubscription) {
    cleanupSubscription.unsubscribe();
    cleanupSubscription = null;
  }
}
