/**
 * Tracked Observable
 *
 * Returns an observable that switches source when hmr_track.entity_id changes.
 * The proxy layer that makes HMR work - subscriptions stay alive, source swaps underneath.
 */

import { Observable, type Subscription } from "rxjs"
import { __withNoTrack, state$ } from "../00.types"
import { createId } from "../01_helpers"
import { state$$ } from "../03_scan-accumulator"

/**
 * Create an observable that tracks an hmr_track entry.
 * When entity_id changes, unsubs old source, subs to new source.
 * User subscriptions see seamless switch.
 */
export function trackedObservable<T>(trackPath: string): Observable<T> {
  return new Observable<T>(subscriber => {
    let innerSub: Subscription | null = null
    let lastEntityId: string | undefined

    const connectToSource = (entityId: string) => {
      if (entityId === lastEntityId) return
      lastEntityId = entityId

      // NOTE: We don't use __withNoTrack here because defer factories
      // need tracking enabled to properly track inner observables
      innerSub?.unsubscribe()
      const obsRecord = state$.value.store.observable[entityId]
      const sourceObs = obsRecord?.obs_ref?.deref()
      if (sourceObs) {
        // Push synthetic subscription context so defer factories get scoped track keys
        // This is needed because trackedObservable itself isn't tracked (created with __withNoTrack)
        const syntheticSub = {
          id: createId(),
          created_at: 0,
          observable_id: entityId,
        }
        state$.value.stack.subscription.push(syntheticSub as any)

        try {
          innerSub = sourceObs.subscribe({
            next: v => subscriber.next(v),
            error: e => subscriber.error(e),
            complete: () => subscriber.complete(),
          })
        } finally {
          state$.value.stack.subscription.pop()
        }
      }
    }

    // Check current state immediately
    // First check store, then check stack (track might still be on stack during construction)
    let initialEntityId = state$.value.store.hmr_track[trackPath]?.entity_id
    if (!initialEntityId) {
      // Track might be on stack (we're inside __$ call, before track-call-return)
      const stackTrack = state$.value.stack.hmr_track.find(t => t.id === trackPath)
      initialEntityId = stackTrack?.entity_id
    }
    if (initialEntityId) {
      connectToSource(initialEntityId)
    }

    // Watch for changes - internal subscription, no tracking
    const watchSub = __withNoTrack(() =>
      state$$.subscribe(s => {
        const entityId = s.store.hmr_track[trackPath]?.entity_id
        if (entityId) {
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
}
