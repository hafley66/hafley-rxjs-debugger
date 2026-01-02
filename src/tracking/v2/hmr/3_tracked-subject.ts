/**
 * Tracked Subject
 *
 * Returns a Subject that forwards to the current inner Subject.
 * When hmr_track.entity_id changes, subsequent calls forward to the new Subject.
 * Bi-directional: both .subscribe() and .next()/.error()/.complete() forward.
 */

import { Subject, type Subscription } from "rxjs"
import { __withNoTrack, state$ } from "../00.types"
import { state$$ } from "../03_scan-accumulator"

/**
 * Create a Subject that tracks an hmr_track entry.
 * All methods forward to the current inner Subject based on entity_id.
 */
export function trackedSubject<T>(trackPath: string): Subject<T> {
  let lastEntityId: string | undefined
  let currentSubject: Subject<T> | undefined
  let watchSub: Subscription | null = null

  const getCurrentSubject = (): Subject<T> | undefined => {
    const entityId = state$.value.store.hmr_track[trackPath]?.entity_id
    if (entityId && entityId !== lastEntityId) {
      lastEntityId = entityId
      const obsRecord = state$.value.store.observable[entityId]
      currentSubject = obsRecord?.obs_ref?.deref() as Subject<T> | undefined
    }
    return currentSubject
  }

  // Initial lookup
  getCurrentSubject()

  // Watch for HMR changes
  watchSub = __withNoTrack(() =>
    state$$.subscribe(() => {
      getCurrentSubject()
    }),
  )

  // Create a proxy Subject that forwards everything
  const proxy = new Subject<T>()

  // Override next/error/complete to forward to current inner Subject
  const originalNext = proxy.next.bind(proxy)
  const originalError = proxy.error.bind(proxy)
  const originalComplete = proxy.complete.bind(proxy)

  proxy.next = (value: T) => {
    const inner = getCurrentSubject()
    if (inner) {
      inner.next(value)
    }
    // Also emit on proxy so direct subscribers get values
    originalNext(value)
  }

  proxy.error = (err: any) => {
    const inner = getCurrentSubject()
    if (inner) {
      inner.error(err)
    }
    originalError(err)
  }

  proxy.complete = () => {
    const inner = getCurrentSubject()
    if (inner) {
      inner.complete()
    }
    originalComplete()
  }

  // Override subscribe to forward to current inner Subject
  const originalSubscribe = proxy.subscribe.bind(proxy)
  proxy.subscribe = ((...args: any[]) => {
    const inner = getCurrentSubject()
    if (inner) {
      return __withNoTrack(() => inner.subscribe(...args))
    }
    return originalSubscribe(...args)
  }) as typeof proxy.subscribe

  return proxy
}
