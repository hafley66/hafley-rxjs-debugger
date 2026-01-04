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
import { state$, TRACKED_MARKER } from "../00.types"
import { createId } from "../01_helpers"
import { emit } from "../01.patch-observable"
import { findTrackByKey } from "./1_queries"
import { trackedObservable } from "./2_tracked-observable"
import { trackedSubject } from "./3_tracked-subject"

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
  const hasSubscriptionPrefix = state$.value.stack.hmr_track.some(t => t.key.startsWith("$ref["))

  // Use send context if in a callback, otherwise use subscription context if in a factory (like defer)
  const subscriptionContext = send?.subscription_id ?? sub?.id
  const observableContext = send?.observable_id ?? sub?.observable_id
  const effectiveLocation =
    subscriptionContext && observableContext && !hasSubscriptionPrefix
      ? `$ref[${observableContext}]:subscription[${subscriptionContext}]:${location}`
      : location

  // Check for existing track (HMR re-execution) or generate new surrogate id
  const existingTrack = findTrackByKey(state$.value, effectiveLocation)
  const trackId = existingTrack?.id ?? createId()

  emit({ type: "track-call", id: trackId, key: effectiveLocation })

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
      // Lookup by surrogate id (O(1)) - store keyed by id
      const trackInStore = state$.value.store.hmr_track[trackId]
      const trackOnStack = state$.value.stack.hmr_track.at(-1)
      // Capture mutable_observable_id BEFORE creating wrapper
      // (wrapper's constructor-call-return will incorrectly overwrite it)
      const mutableIdBeforeWrapper = trackOnStack?.mutable_observable_id
      // Look up stable wrapper via observable table (obs_ref is the single source of truth)
      const stableId = trackInStore?.stable_observable_id
      let stable = stableId ? state$.value.store.observable[stableId]?.obs_ref?.deref() : undefined
      if (!stable) {
        // trackedSubject sets TRACKED_MARKER internally - pass track id, not key
        stable = trackedSubject(trackId)
        // Set stable_observable_id explicitly - TRACKED_MARKER timing doesn't work
        // (constructor-call-return fires before marker is set)
        if (trackOnStack) {
          trackOnStack.stable_observable_id = (stable as any).__id__
          // Restore mutable_observable_id (wrapper's constructor overwrote it)
          if (mutableIdBeforeWrapper) {
            trackOnStack.mutable_observable_id = mutableIdBeforeWrapper
          }
        }
      }
      return stable as T
    }

    // If result is an Observable (cold), return stable trackedObservable wrapper
    if (result instanceof Observable) {
      // Lookup by surrogate id (O(1)) - store keyed by id
      const trackInStore = state$.value.store.hmr_track[trackId]
      const trackOnStack = state$.value.stack.hmr_track.at(-1)
      // Capture mutable_observable_id BEFORE creating wrapper
      const mutableIdBeforeWrapper = trackOnStack?.mutable_observable_id
      // Look up stable wrapper via observable table (obs_ref is the single source of truth)
      const stableId = trackInStore?.stable_observable_id
      let stable = stableId ? state$.value.store.observable[stableId]?.obs_ref?.deref() : undefined
      if (!stable) {
        // trackedObservable sets TRACKED_MARKER internally - pass track id, not key
        stable = trackedObservable(trackId)
        // Set stable_observable_id explicitly - TRACKED_MARKER timing doesn't work
        // (constructor-call-return fires before marker is set)
        if (trackOnStack) {
          trackOnStack.stable_observable_id = (stable as any).__id__
          // Restore mutable_observable_id (wrapper's constructor overwrote it)
          if (mutableIdBeforeWrapper) {
            trackOnStack.mutable_observable_id = mutableIdBeforeWrapper
          }
        }
      }
      return stable as T
    }

    return result
  } finally {
    emit({ type: "track-call-return", id: trackId })
  }
}
