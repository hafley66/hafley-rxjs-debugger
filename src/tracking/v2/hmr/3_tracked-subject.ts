/**
 * Tracked Subject
 *
 * Returns a Subject that forwards to the current inner Subject.
 * When hmr_track.entity_id changes, subsequent calls forward to the new Subject.
 *
 * Bi-directional sync:
 * - proxy.next/error/complete → forwards to inner
 * - inner.next/error/complete → forwards to proxy (for captured raw inner)
 */

import { BehaviorSubject, Subject, type Subscription } from "rxjs"
import { __withNoTrack, state$ } from "../00.types"
import { state$$ } from "../03_scan-accumulator"

/**
 * Create a Subject that tracks an hmr_track entry.
 * All methods forward to the current inner Subject based on entity_id.
 */
export function trackedSubject<T>(trackPath: string): Subject<T> {
  let lastEntityId: string | undefined
  let currentSubject: Subject<T> | undefined
  let innerSub: Subscription | null = null
  let isForwarding = false // prevent proxy→inner→proxy loops

  // Create proxy Subject (untracked - it's infrastructure, not user code)
  const proxy = __withNoTrack(() => new Subject<T>())
  const originalNext = proxy.next.bind(proxy)
  const originalError = proxy.error.bind(proxy)
  const originalComplete = proxy.complete.bind(proxy)

  // Subscribe to inner and forward emissions to proxy (inner→proxy)
  const subscribeToInner = (inner: Subject<T>) => {
    if (innerSub) {
      innerSub.unsubscribe()
      innerSub = null
    }
    innerSub = __withNoTrack(() =>
      inner.subscribe({
        next: (v) => {
          if (!isForwarding) originalNext(v)
        },
        error: (e) => {
          if (!isForwarding) originalError(e)
        },
        complete: () => {
          if (!isForwarding) originalComplete()
        },
      }),
    )
  }

  const getCurrentSubject = (): Subject<T> | undefined => {
    const entityId = state$.value.store.hmr_track[trackPath]?.entity_id
    if (entityId && entityId !== lastEntityId) {
      lastEntityId = entityId
      const obsRecord = state$.value.store.observable[entityId]
      const newSubject = obsRecord?.obs_ref?.deref() as Subject<T> | undefined
      if (newSubject && newSubject !== currentSubject) {
        currentSubject = newSubject
        subscribeToInner(currentSubject)
      }
    }
    return currentSubject
  }

  // Initial lookup
  getCurrentSubject()

  // Watch for HMR changes - update inner subscription when entity_id changes
  __withNoTrack(() =>
    state$$.subscribe(() => {
      getCurrentSubject()
    }),
  )

  // Override next/error/complete to forward to current inner Subject (proxy→inner)
  proxy.next = (value: T) => {
    const inner = getCurrentSubject()
    if (inner) {
      isForwarding = true
      try {
        inner.next(value)
      } finally {
        isForwarding = false
      }
    }
    originalNext(value)
  }

  proxy.error = (err: any) => {
    const inner = getCurrentSubject()
    if (inner) {
      isForwarding = true
      try {
        inner.error(err)
      } finally {
        isForwarding = false
      }
    }
    originalError(err)
  }

  proxy.complete = () => {
    const inner = getCurrentSubject()
    if (inner) {
      isForwarding = true
      try {
        inner.complete()
      } finally {
        isForwarding = false
      }
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

/**
 * Create a BehaviorSubject that tracks an hmr_track entry.
 * Extends trackedSubject pattern with .value and .getValue() forwarding.
 */
export function trackedBehaviorSubject<T>(
  trackPath: string,
  initialValue: T,
): BehaviorSubject<T> {
  let lastEntityId: string | undefined
  let currentSubject: BehaviorSubject<T> | undefined
  let innerSub: Subscription | null = null
  let isForwarding = false

  // Create proxy BehaviorSubject (untracked - it's infrastructure, not user code)
  const proxy = __withNoTrack(() => new BehaviorSubject<T>(initialValue))
  const originalNext = proxy.next.bind(proxy)
  const originalError = proxy.error.bind(proxy)
  const originalComplete = proxy.complete.bind(proxy)

  // Subscribe to inner and forward emissions to proxy (inner→proxy)
  const subscribeToInner = (inner: BehaviorSubject<T>) => {
    if (innerSub) {
      innerSub.unsubscribe()
      innerSub = null
    }
    innerSub = __withNoTrack(() =>
      inner.subscribe({
        next: (v) => {
          if (!isForwarding) originalNext(v)
        },
        error: (e) => {
          if (!isForwarding) originalError(e)
        },
        complete: () => {
          if (!isForwarding) originalComplete()
        },
      }),
    )
  }

  const getCurrentSubject = (): BehaviorSubject<T> | undefined => {
    const entityId = state$.value.store.hmr_track[trackPath]?.entity_id
    if (entityId && entityId !== lastEntityId) {
      lastEntityId = entityId
      const obsRecord = state$.value.store.observable[entityId]
      const newSubject = obsRecord?.obs_ref?.deref() as
        | BehaviorSubject<T>
        | undefined
      if (newSubject && newSubject !== currentSubject) {
        currentSubject = newSubject
        subscribeToInner(currentSubject)
      }
    }
    return currentSubject
  }

  // Initial lookup
  getCurrentSubject()

  // Watch for HMR changes
  __withNoTrack(() =>
    state$$.subscribe(() => {
      getCurrentSubject()
    }),
  )

  // Override next/error/complete to forward to current inner Subject (proxy→inner)
  proxy.next = (value: T) => {
    const inner = getCurrentSubject()
    if (inner) {
      isForwarding = true
      try {
        inner.next(value)
      } finally {
        isForwarding = false
      }
    }
    originalNext(value)
  }

  proxy.error = (err: any) => {
    const inner = getCurrentSubject()
    if (inner) {
      isForwarding = true
      try {
        inner.error(err)
      } finally {
        isForwarding = false
      }
    }
    originalError(err)
  }

  proxy.complete = () => {
    const inner = getCurrentSubject()
    if (inner) {
      isForwarding = true
      try {
        inner.complete()
      } finally {
        isForwarding = false
      }
    }
    originalComplete()
  }

  // Override getValue to return current inner's value
  const originalGetValue = proxy.getValue.bind(proxy)
  proxy.getValue = () => {
    const inner = getCurrentSubject()
    return inner ? inner.getValue() : originalGetValue()
  }

  // Override value getter to return current inner's value
  Object.defineProperty(proxy, "value", {
    get() {
      const inner = getCurrentSubject()
      return inner ? inner.value : originalGetValue()
    },
  })

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
