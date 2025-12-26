/**
 * Observable wrapper for RxJS devtools
 *
 * Extends RxJS Observable to intercept construction and capture metadata.
 * The constructor checks operatorContext.peek() to determine if the observable
 * is being created at pipe-time (static) or subscribe-time (dynamic).
 */

import { Observable as RxJSObservable } from 'rxjs';
import { getCallerInfo } from './stack-parser';
import {
  generateObservableId,
  registerObservable,
  operatorContext,
  pipeContext,
} from './registry';
import { writeQueue$ } from './storage';
import type { ObservableMetadata } from './types';

/**
 * Tracked Observable class
 *
 * Drop-in replacement for RxJS Observable that captures creation metadata.
 * Zero behavioral changes - just tracking on top.
 *
 * ALWAYS registers observables (pipe-time metadata).
 * Subscribe-time tracking (emissions, subscriptions) controlled by config.
 */
class OObservable<T> extends RxJSObservable<T> {
  constructor(subscribe?: (subscriber: any) => any) {
    super(subscribe);

    // Capture static context from stack trace
    const callerInfo = getCallerInfo();

    // THE KEY: Check operator execution context
    // If stack is empty -> pipe/module time creation (static)
    // If stack has entries -> subscribe-time creation (dynamic)
    const ctx = operatorContext.peek();

    // Check pipe context for grouping
    const pipeCtx = pipeContext.peek();

    const metadata: ObservableMetadata = {
      id: generateObservableId(),
      createdAt: Date.now(),
      location: {
        filePath: callerInfo?.filePath || 'unknown',
        line: callerInfo?.line || 0,
        column: callerInfo?.column || 0,
      },
      variableName: callerInfo?.context,
      operators: [],
      path: '',
      pipeGroupId: pipeCtx?.pipeId,

      // Dynamic context (only set if created during operator execution)
      // If undefined -> pure pipe/module time creation
      // If set -> dynamic subscribe-time creation (e.g., switchMap inner observable)
      createdByOperator: ctx?.operatorName,
      operatorInstanceId: ctx?.operatorInstanceId,
      triggeredBySubscription: ctx?.subscriptionId,
      triggeredByObservable: ctx?.observableId,
      triggeredByEvent: ctx?.event,

      // argumentPath will be set by argument wrapper functions if applicable
    };

    // ALWAYS register observables (pipe-time tracking)
    registerObservable(this, metadata);

    // Queue write to storage (batched)
    writeQueue$.next({
      store: 'observables',
      key: metadata.id,
      data: metadata,
    });
  }
}

// Export as Observable for drop-in replacement
export { OObservable as Observable };

// Re-export everything else from rxjs
export * from 'rxjs';
