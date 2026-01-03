/**
 * HMR Track Runtime
 *
 * __$ wraps RxJS code for HMR tracking. Parser injects these calls.
 * Uses state$.stack.hmr_track for context - accumulator handles push/pop.
 *
 * Returns trackedObservable wrapper for Observables so external subscribers
 * seamlessly receive values from new inner observable after HMR swap.
 */

import { BehaviorSubject, Observable, Subject } from "rxjs"
import { __withNoTrack, state$ } from "../00.types"
import { emit } from "../01.patch-observable"
import { trackedObservable } from "./2_tracked-observable"
import { trackedSubject } from "./3_tracked-subject"

// Marker to identify our tracked wrappers
export const TRACKED_MARKER = Symbol("rxjs-debugger-tracked")

// Only treat direct Subject/BehaviorSubject instances as Subjects
// AnonymousSubject (from .pipe()) should be treated as Observable
// Also exclude our own tracked wrappers
function isRealSubject(val: any): val is Subject<any> {
  if (val == null) return false
  if ((val as any)[TRACKED_MARKER]) return false // Already tracked
  return val.constructor === Subject || val.constructor === BehaviorSubject
}

function isTrackedWrapper(val: any): boolean {
  return val != null && !!(val as any)[TRACKED_MARKER]
}

export type TrackContext = <T>(name: string, fn: ($: TrackContext) => T) => T

export function __$<T>(location: string, fn: ($: TrackContext) => T): T {
  // Dynamic observable naming: prepend subscription context if inside send (callback) or subscription (factory)
  // Only add prefix if no track on stack already has subscription context (avoid double-prefix)
  const send = state$.value.stack.send.at(-1)
  const sub = state$.value.stack.subscription.at(-1)
  const hasSubscriptionPrefix = state$.value.stack.hmr_track.some(t => t.id.startsWith("$ref["))

  // Use send context if in a callback, otherwise use subscription context if in a factory (like defer)
  const subscriptionContext = send?.subscription_id ?? sub?.id
  const observableContext = send?.observable_id ?? sub?.observable_id
  console.log("[__$] location:", location, "send:", !!send, "sub:", !!sub, "hasPrefix:", hasSubscriptionPrefix)
  console.log("[__$] subscriptionContext:", subscriptionContext, "observableContext:", observableContext)
  const effectiveLocation =
    subscriptionContext && observableContext && !hasSubscriptionPrefix
      ? `$ref[${observableContext}]:subscription[${subscriptionContext}]:${location}`
      : location
  console.log("[__$] effectiveLocation:", effectiveLocation)

  emit({ type: "track-call", id: effectiveLocation })

  const $: TrackContext = <V>(name: string, childFn: ($: TrackContext) => V): V => {
    return __$(`${effectiveLocation}:${name}`, childFn)
  }

  try {
    const result = fn($)

    // If result is already a tracked wrapper, just return it
    // (e.g., returning an already-tracked Subject from a nested scope)
    if (isTrackedWrapper(result)) {
      return result
    }

    // If result is a function, wrap to re-invoke __$ on each call
    if (typeof result === "function") {
      const wrapped = (...args: any[]) => {
        return __$(location, () => (result as Function)(...args))
      }
      return wrapped as T
    }

    // If result is a real Subject (not AnonymousSubject from .pipe()), return stable trackedSubject wrapper
    if (isRealSubject(result)) {
      // Check store first (for HMR re-execution), then stack (for first execution)
      const trackInStore = state$.value.store.hmr_track[effectiveLocation]
      const trackOnStack = state$.value.stack.hmr_track.at(-1)
      let stable = trackInStore?.stable_ref?.deref()
      if (!stable) {
        stable = __withNoTrack(() => trackedSubject(effectiveLocation))
        ;(stable as any)[TRACKED_MARKER] = true
        // Set on stack entity (same object that will be stored on track-call-return)
        if (trackOnStack) {
          trackOnStack.stable_ref = new WeakRef(stable!)
        }
      }
      return stable as T
    }

    // If result is an Observable (cold), return stable trackedObservable wrapper
    if (result instanceof Observable) {
      const trackInStore = state$.value.store.hmr_track[effectiveLocation]
      const trackOnStack = state$.value.stack.hmr_track.at(-1)
      let stable = trackInStore?.stable_ref?.deref()
      if (!stable) {
        stable = __withNoTrack(() => trackedObservable(effectiveLocation))
        ;(stable as any)[TRACKED_MARKER] = true
        if (trackOnStack) {
          trackOnStack.stable_ref = new WeakRef(stable!)
        }
      }
      return stable as T
    }

    return result
  } finally {
    emit({ type: "track-call-return", id: effectiveLocation })
  }
}
