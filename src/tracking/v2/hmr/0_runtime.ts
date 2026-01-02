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

export type TrackContext = <T>(name: string, fn: ($: TrackContext) => T) => T

export function __$<T>(location: string, fn: ($: TrackContext) => T): T {
  emit({ type: "track-call", id: location })

  const $: TrackContext = <V>(name: string, childFn: ($: TrackContext) => V): V => {
    return __$(`${location}:${name}`, childFn)
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

    // If result is an Observable (but NOT a Subject), return stable trackedObservable wrapper
    // Subjects need bi-sync pattern (deferred) - return raw for now
    if (result instanceof Observable && !(result instanceof Subject)) {
      const track = state$.value.store.hmr_track[location]
      let stable = track?.stable_ref?.deref()
      if (!stable) {
        // Create trackedObservable without tracking (it's infrastructure, not user code)
        stable = __withNoTrack(() => trackedObservable(location))
        // Store stable_ref on track entity (created by accumulator on track-call-return)
        queueMicrotask(() => {
          const t = state$.value.store.hmr_track[location]
          if (t) {
            t.stable_ref = new WeakRef(stable!)
          }
        })
      }
      return stable as T
    }

    return result
  } finally {
    emit({ type: "track-call-return", id: location })
  }
}
