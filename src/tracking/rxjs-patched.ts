/**
 * Patched RxJS exports
 *
 * Re-exports RxJS with tracking:
 * - Creation functions (of, from, interval, etc.) register returned observables
 * - Observable class replaced with OObservable
 *
 * Usage:
 *   import { interval, of, Observable } from './tracking/rxjs-patched';
 *   // Instead of: import { interval, of, Observable } from 'rxjs';
 */

import * as rx from "rxjs"
// Import argument-detecting wrappers for combination functions
import {
  combineLatest as argCombineLatest,
  concat as argConcat,
  forkJoin as argForkJoin,
  merge as argMerge,
  onErrorResumeNext as argOnErrorResumeNext,
  race as argRace,
  zip as argZip,
} from "./argument-detection"
import { isTrackingEnabled } from "./config"
import { Observable } from "./observable-wrapper"
import { patchPipe } from "./pipe-patch"
import { generateObservableId, observableMetadata, operatorContext } from "./registry"
import { writeQueue$ } from "./storage"
import { patchSubscribe } from "./subscribe-patch"
import type { ObservableMetadata } from "./types"

// Apply patches when this module loads
patchPipe()
patchSubscribe()

/**
 * Wrap a creation function to register the returned observable
 *
 * CRITICAL: Checks operatorContext to link inner observables to their parent operator.
 * Without this, from() inside switchMap wouldn't know it was created by switchMap.
 */
function wrapCreation<T extends (...args: any[]) => rx.Observable<any>>(fn: T, name: string): T {
  return ((...args: any[]) => {
    const obs = fn(...args)

    // If tracking is disabled, just return the observable without registration
    if (!isTrackingEnabled()) {
      return obs
    }

    // THE KEY: Check operator execution context
    // If stack is empty -> pipe/module time creation (static)
    // If stack has entries -> subscribe-time creation (dynamic, e.g., from() inside switchMap)
    const ctx = operatorContext.peek()

    // Check if already registered (e.g., by OObservable constructor)
    const existing = observableMetadata.get(obs)

    if (existing) {
      // Update existing metadata with operator context if we have it
      if (ctx && !existing.createdByOperator) {
        existing.createdByOperator = ctx.operatorName
        existing.operatorInstanceId = ctx.operatorInstanceId
        existing.triggeredBySubscription = ctx.subscriptionId
        existing.triggeredByObservable = ctx.observableId
        existing.triggeredByEvent = ctx.event

        // Update in storage
        const { parent, ...serializableMetadata } = existing
        writeQueue$.next({
          store: "observables",
          key: existing.id,
          data: serializableMetadata,
        })
      }
    } else {
      const metadata: ObservableMetadata = {
        id: generateObservableId(),
        createdAt: Date.now(),
        // variableName comes from __track$ vite plugin, not stack traces
        creationFn: name, // "from", "interval", etc.
        operators: [],
        path: "",

        // Dynamic context (only set if created during operator execution)
        createdByOperator: ctx?.operatorName,
        operatorInstanceId: ctx?.operatorInstanceId,
        triggeredBySubscription: ctx?.subscriptionId,
        triggeredByObservable: ctx?.observableId,
        triggeredByEvent: ctx?.event,
      }

      observableMetadata.set(obs, metadata)

      writeQueue$.next({
        store: "observables",
        key: metadata.id,
        data: metadata,
      })
    }

    return obs
  }) as T
}

/**
 * Auto-wrap all creation functions from an object
 */
function autoWrapCreations<const T extends Record<string, any>>(
  fns: T,
  names: string[],
): Pick<T, (typeof names)[number]> {
  const result: any = {}
  for (const name of names) {
    if (typeof fns[name] === "function") {
      result[name] = wrapCreation(fns[name], name)
    }
  }
  return result
}

// Creation functions to wrap (basic registration only)
// NOTE: merge, concat, combineLatest, forkJoin, zip, race, onErrorResumeNext
// are handled by argument-detection.ts with observable argument scanning
const creationFunctionNames = [
  "of",
  "from",
  "interval",
  "timer",
  "defer",
  "range",
  "generate",
  "empty",
  "never",
  "throwError",
  "ajax",
  "fromEvent",
  "fromEventPattern",
  "fromFetch",
  "bindCallback",
  "bindNodeCallback",
  "partition",
  "iif",
  "using",
]

const wrappedCreations = autoWrapCreations(rx, creationFunctionNames)

// Export wrapped creation functions (basic registration)
export const { of, from, interval, timer, defer, range, generate, throwError, fromEvent, fromEventPattern, iif } =
  wrappedCreations

// Export argument-detecting wrappers for combination functions
export {
  argCombineLatest as combineLatest,
  argMerge as merge,
  argForkJoin as forkJoin,
  argZip as zip,
  argRace as race,
  argConcat as concat,
  argOnErrorResumeNext as onErrorResumeNext,
}

// Export our Observable
export { Observable }

// Re-export types
export type {
  MonoTypeOperatorFunction,
  ObservableInput,
  ObservableInputTuple,
  ObservedValueOf,
  Observer,
  Operator,
  OperatorFunction,
  SchedulerAction,
  SchedulerLike,
  SubjectLike,
  TeardownLogic,
  UnaryFunction,
  Unsubscribable,
} from "rxjs"

// Re-export everything else from rxjs that wasn't overridden
export {
  animationFrameScheduler,
  asapScheduler,
  asyncScheduler,
  config,
  connectable,
  EMPTY,
  firstValueFrom,
  identity,
  isObservable,
  lastValueFrom,
  NEVER,
  noop,
  pipe,
  queueScheduler,
  Scheduler,
  Subscriber,
  Subscription,
  scheduled,
  VirtualTimeScheduler,
} from "rxjs"
// Re-export Subject and variants with proxied constructors that capture creation context
export { AsyncSubject, BehaviorSubject, ReplaySubject, Subject } from "./constructor-proxy"
