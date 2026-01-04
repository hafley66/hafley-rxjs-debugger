/**
 * Tracked Observable
 *
 * Returns an observable that switches source when hmr_track.mutable_observable_id changes.
 * The proxy layer that makes HMR work - subscriptions stay alive, source swaps underneath.
 *
 * The wrapper IS the tracked entity - registered in store.observable with its own random ID.
 * User subscriptions point to the stable wrapper ID, not ephemeral inner observable IDs.
 */

import { Observable, type Subscription } from "rxjs"
import { __withNoTrack, state$, TRACKED_MARKER } from "../00.types"
import { state$$ } from "../03_scan-accumulator"

/**
 * Create an observable that tracks an hmr_track entry.
 * When mutable_observable_id changes, unsubs old source, subs to new source.
 * User subscriptions see seamless switch.
 */
export function trackedObservable<T>(trackId: string): Observable<T> {
  // Capture module context at creation time for later restoration
  // Lookup by id - O(1). Fall back to stack for first execution (before track-call-return)
  const track = state$.value.store.hmr_track[trackId]
    ?? state$.value.stack.hmr_track.find(t => t.id === trackId)
  const moduleId = track?.module_id

  const obs = new Observable<T>(subscriber => {
    let innerSub: Subscription | null = null
    let lastEntityId: string | undefined

    const connectToSource = (entityId: string) => {
      if (entityId === lastEntityId) return
      lastEntityId = entityId

      // Unsubscribe old source (untracked to prevent noise)
      if (innerSub) {
        __withNoTrack(() => innerSub?.unsubscribe())
        innerSub = null
      }

      const obsRecord = state$.value.store.observable[entityId]
      const sourceObs = obsRecord?.obs_ref?.deref()
      if (sourceObs) {
        // Restore module and track context so defer factories get proper tracking
        // Track context is needed for shouldEmit to allow subscribe-call events
        // IMPORTANT: Create a shallow copy of track to avoid mutating the stored track
        const storedTrack = state$.value.store.hmr_track[trackId]
        const trackCopy = storedTrack ? { ...storedTrack } : undefined
        const module = moduleId ? state$.value.store.hmr_module[moduleId] : undefined

        // Push module/track context but DON'T enable tracking
        // This lets defer factories see the context but doesn't create subscribe-call events
        if (module && trackCopy) {
          state$.value.stack.hmr_module.push(module)
          state$.value.stack.hmr_track.push(trackCopy)
          // DON'T set isEnabled$.next(true) - that causes subscribe events which cascade
        }

        try {
          // Subscribe to inner - plumbing detection in accumulator handles skipping
          // this wrapper→inner subscription event (subscribe-call sees parent=wrapper,
          // target=inner which matches an hmr_track entry)
          innerSub = sourceObs.subscribe({
            next: v => subscriber.next(v),
            error: e => subscriber.error(e),
            complete: () => subscriber.complete(),
          })
        } finally {
          if (module && trackCopy) {
            state$.value.stack.hmr_track.pop()
            state$.value.stack.hmr_module.pop()
          }
        }
      }
    }

    // Check current state immediately
    // First check store, then check stack (track might still be on stack during construction)
    let initialEntityId = state$.value.store.hmr_track[trackId]?.mutable_observable_id
    if (!initialEntityId) {
      // Track might be on stack (we're inside __$ call, before track-call-return)
      const stackTrack = state$.value.stack.hmr_track.find(t => t.id === trackId)
      initialEntityId = stackTrack?.mutable_observable_id
    }
    if (initialEntityId) {
      connectToSource(initialEntityId)
    }

    // Watch for changes - internal subscription, no tracking
    // Only reconnect if mutable_observable_id actually changes (HMR scenario)
    const watchSub = __withNoTrack(() =>
      state$$.subscribe(s => {
        const entityId = s.store.hmr_track[trackId]?.mutable_observable_id
        if (entityId && entityId !== lastEntityId) {
          connectToSource(entityId)
        }
      }),
    )

    return () => {
      __withNoTrack(() => {
        innerSub?.unsubscribe()
        watchSub.unsubscribe()
      })
    }
  })

  // Mark as tracked wrapper so accumulator sets stable_observable_id instead of mutable_observable_id
  ;(obs as any)[TRACKED_MARKER] = true
  return obs
}
