/**
 * Tracked Observable
 *
 * Returns an observable that switches source when hmr_track.entity_id changes.
 * The proxy layer that makes HMR work - subscriptions stay alive, source swaps underneath.
 */

import { Observable, type Subscription } from "rxjs"
import { __withNoTrack, state$ } from "../00.types"
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

      __withNoTrack(() => {
        innerSub?.unsubscribe()
        const obsRecord = state$.value.store.observable[entityId]
        const sourceObs = obsRecord?.obs_ref?.deref()
        if (sourceObs) {
          // Wrap subscriber to avoid linking - unsubscribe shouldn't close outer subscriber
          innerSub = sourceObs.subscribe({
            next: v => subscriber.next(v),
            error: e => subscriber.error(e),
            complete: () => subscriber.complete(),
          })
        }
      })
    }

    // Check current state immediately
    const initialEntityId = state$.value.store.hmr_track[trackPath]?.entity_id
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
