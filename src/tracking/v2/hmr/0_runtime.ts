/**
 * HMR Track Runtime
 *
 * __$ wraps RxJS code for HMR tracking. Parser injects these calls.
 * Uses state$.stack.hmr_track for context - accumulator handles push/pop.
 *
 * Returns trackedObservable wrapper for Observables so external subscribers
 * seamlessly receive values from new inner observable after HMR swap.
 */

import { Observable, Subject } from "rxjs"
import { __withNoTrack, state$ } from "../00.types"
import { emit } from "../01.patch-observable"
import { trackedObservable } from "./2_tracked-observable"
import { trackedSubject } from "./3_tracked-subject"

export type TrackContext = <T>(name: string, fn: ($: TrackContext) => T) => T

export function __$<T>(location: string, fn: ($: TrackContext) => T): T {
  // Dynamic observable naming: prepend subscription context if inside send (callback)
  // Only add prefix if no track on stack already has subscription context (avoid double-prefix)
  const send = state$.value.stack.send.at(-1)
  const hasSubscriptionPrefix = state$.value.stack.hmr_track.some(t => t.id.startsWith("$ref["))
  const effectiveLocation = send && !hasSubscriptionPrefix
    ? `$ref[${send.observable_id}]:subscription[${send.subscription_id}]:${location}`
    : location

  emit({ type: "track-call", id: effectiveLocation })

  const $: TrackContext = <V>(name: string, childFn: ($: TrackContext) => V): V => {
    return __$(`${effectiveLocation}:${name}`, childFn)
  }

  try {
    const result = fn($)

    // If result is a function, wrap to re-invoke __$ on each call
    if (typeof result === "function") {
      const wrapped = (...args: any[]) => {
        return __$(location, () => (result as Function)(...args))
      }
      return wrapped as T
    }

    // If result is a Subject, return stable trackedSubject wrapper (bi-sync forwarding)
    if (result instanceof Subject) {
      // Check store first (for HMR re-execution), then stack (for first execution)
      const trackInStore = state$.value.store.hmr_track[effectiveLocation]
      const trackOnStack = state$.value.stack.hmr_track.at(-1)
      let stable = trackInStore?.stable_ref?.deref()
      if (!stable) {
        stable = __withNoTrack(() => trackedSubject(effectiveLocation))
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
