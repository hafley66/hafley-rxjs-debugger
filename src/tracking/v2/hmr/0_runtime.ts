/**
 * HMR Track Runtime
 *
 * __$ wraps RxJS code for HMR tracking. Parser injects these calls.
 * Uses state$.stack.hmr_track for context - accumulator handles push/pop.
 */

import { emit } from "../01.patch-observable"

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

    return result
  } finally {
    emit({ type: "track-call-return", id: location })
  }
}
