import { describe, expect, it } from "vitest"
import { Subject } from "rxjs"
import { __$ } from "./0_runtime"
import { state$ } from "../00.types"
import "../03_scan-accumulator"
import { proxy } from "../04.operators"
import { useTrackingTestSetup } from "../0_test-utils"
import { getDanglingSubscriptions } from "../06_queries"

describe("__$ HMR runtime", () => {
  useTrackingTestSetup()

  it("tracks observable creation", () => {
    __$("test:obs", () => proxy.of(1, 2, 3))

    expect(state$.value.store.hmr_track["test:obs"]).toMatchInlineSnapshot(`
      {
        "created_at": 0,
        "created_at_end": 0,
        "entity_id": "0",
        "entity_type": "observable",
        "id": "test:obs",
        "index": 0,
        "parent_track_id": undefined,
        "prev_entity_ids": [],
        "stable_ref": WeakRef {},
        "version": 0,
      }
    `)
  })

  it("tracks nested scopes with child $ tracker", () => {
    __$("root", ($) => {
      return $("child", () => proxy.of(1))
    })

    expect(state$.value.store.hmr_track).toMatchInlineSnapshot(`
      {
        "root:child": {
          "created_at": 0,
          "created_at_end": 0,
          "entity_id": "0",
          "entity_type": "observable",
          "id": "root:child",
          "index": 0,
          "parent_track_id": "root",
          "prev_entity_ids": [],
          "stable_ref": WeakRef {},
          "version": 0,
        },
      }
    `)
  })

  it("tracks pipe - last entity in scope wins", () => {
    __$("test:pipe", () =>
      proxy.of(1, 2, 3).pipe(
        proxy.map((x) => x * 2),
        proxy.take(2)
      )
    )

    expect(state$.value.store.hmr_track["test:pipe"]).toMatchInlineSnapshot(`
      {
        "created_at": 0,
        "created_at_end": 0,
        "entity_id": "25",
        "entity_type": "observable",
        "id": "test:pipe",
        "index": 0,
        "parent_track_id": undefined,
        "prev_entity_ids": [],
        "stable_ref": WeakRef {},
        "version": 0,
      }
    `)
  })

  it("wraps function returns to re-push track on each call", () => {
    const getObs = __$("test:fn", () => {
      return (n: number) => proxy.of(n)
    })

    expect(state$.value.store.hmr_track["test:fn"]).toMatchInlineSnapshot(`undefined`)

    getObs(1)
    getObs(2)

    expect(state$.value.store.hmr_track["test:fn"]).toMatchInlineSnapshot(`
      {
        "created_at": 0,
        "created_at_end": 0,
        "entity_id": "6",
        "entity_type": "observable",
        "id": "test:fn",
        "index": 0,
        "last_change_structural": true,
        "parent_track_id": undefined,
        "prev_entity_ids": [
          "0",
        ],
        "stable_ref": WeakRef {},
        "version": 1,
      }
    `)
  })

  it("stack.hmr_track.at(-1) returns current track during scope", () => {
    let capturedTrack: (typeof state$.value.stack.hmr_track)[number] | undefined

    __$("test:peek", () => {
      capturedTrack = state$.value.stack.hmr_track.at(-1)
      return proxy.of(1)
    })

    expect(capturedTrack?.id).toMatchInlineSnapshot(`"test:peek"`)
  })

  it("stack is empty outside of track scope", () => {
    expect(state$.value.stack.hmr_track.at(-1)).toMatchInlineSnapshot(`undefined`)
  })

  it("tracks operator_fun when operators are called inside scope", () => {
    __$("test:op", ($) => {
      return $("myMap", () => proxy.map((x: number) => x * 2))
    })

    expect(state$.value.store.hmr_track["test:op:myMap"]).toMatchInlineSnapshot(`
      {
        "created_at": 0,
        "created_at_end": 0,
        "entity_id": "2",
        "entity_type": "operator_fun",
        "id": "test:op:myMap",
        "index": 0,
        "parent_track_id": "test:op",
        "prev_entity_ids": [],
        "version": 0,
      }
    `)
  })

  it("detects fn-only change when structure same (last_change_structural: false)", () => {
    // First execution
    __$("test:hmr", () => proxy.of(1, 2, 3).pipe(proxy.map((x) => x * 2)))
    const entity1 = state$.value.store.hmr_track["test:hmr"].entity_id
    const obs1Name = state$.value.store.observable[entity1]?.name
    expect(state$.value.store.hmr_track["test:hmr"].version).toBe(0)

    // Simulate HMR: same structure, different fn body
    __$("test:hmr", () => proxy.of(1, 2, 3).pipe(proxy.map((x) => x * 3)))
    const track2 = state$.value.store.hmr_track["test:hmr"]
    const obs2Name = state$.value.store.observable[track2.entity_id]?.name

    expect(track2.version).toBe(1)
    expect(track2.prev_entity_ids).toContain(entity1)
    // Same structure: of(1,2,3).map(fn) → of(1,2,3).map(fn)
    expect(obs1Name).toBe(obs2Name) // Both should serialize the same
    expect((track2 as any).last_change_structural).toBe(false)
  })

  it("detects structural change when operator added (last_change_structural: true)", () => {
    // First execution
    __$("test:structural", () => proxy.of(1, 2, 3).pipe(proxy.map((x) => x * 2)))
    const entity1 = state$.value.store.hmr_track["test:structural"].entity_id
    const obs1Name = state$.value.store.observable[entity1]?.name

    // Simulate HMR: added filter operator
    __$("test:structural", () =>
      proxy.of(1, 2, 3).pipe(
        proxy.map((x) => x * 2),
        proxy.filter((x) => x > 2)
      )
    )

    const track = state$.value.store.hmr_track["test:structural"]
    const obs2Name = state$.value.store.observable[track.entity_id]?.name

    expect({ obs1Name, obs2Name, version: track.version, structural: (track as any).last_change_structural }).toMatchInlineSnapshot(`
      {
        "obs1Name": "of(1,2,3).map(fn)",
        "obs2Name": "of(1,2,3).map(fn).filter(fn)",
        "structural": true,
        "version": 1,
      }
    `)
  })

  it("detects structural change when primitive arg changes", () => {
    // First execution
    __$("test:primitive", () => proxy.of(1, 2, 3).pipe(proxy.take(5)))

    // Simulate HMR: changed take count
    __$("test:primitive", () => proxy.of(1, 2, 3).pipe(proxy.take(10)))

    const track = state$.value.store.hmr_track["test:primitive"]
    expect(track.version).toBe(1)
    // Different structure: take(5) → take(10)
    expect((track as any).last_change_structural).toBe(true)
  })

  it("prepends subscription context to track path when inside send callback", () => {
    // Wrap outer observable in __$ so it has a track (required for send stack to work)
    __$("outer", () => proxy.of(1))
    let innerTrackId: string | undefined
    let sendStackDuringCallback: typeof state$.value.stack.send = []

    // Get the raw observable to subscribe to it with tracking
    const outerEntityId = state$.value.store.hmr_track["outer"].entity_id
    const rawOuter$ = state$.value.store.observable[outerEntityId].obs_ref?.deref()

    rawOuter$!.subscribe(() => {
      // Capture send stack during callback
      sendStackDuringCallback = [...state$.value.stack.send]
      // This __$ call happens during send - should get subscription context
      __$("inner", () => {
        innerTrackId = state$.value.stack.hmr_track.at(-1)?.id
        return proxy.of(2)
      })
    })

    // Verify send stack was populated during callback
    expect(sendStackDuringCallback.length).toBe(1)
    expect(sendStackDuringCallback[0].observable_id).toBe(outerEntityId)

    // Verify track was stored with subscription context prefix
    const subId = sendStackDuringCallback[0].subscription_id
    expect({ innerTrackId, tracks: Object.keys(state$.value.store.hmr_track) }).toMatchInlineSnapshot(`
      {
        "innerTrackId": "$ref[0]:subscription[6]:inner",
        "tracks": [
          "outer",
          "$ref[0]:subscription[6]:inner",
        ],
      }
    `)
  })

  it("nested child $ tracker also gets subscription context", () => {
    // Wrap outer observable in __$ so it has a track (required for send stack)
    __$("parent", () => proxy.of(1))
    const parentEntityId = state$.value.store.hmr_track["parent"].entity_id
    const rawParent$ = state$.value.store.observable[parentEntityId].obs_ref?.deref()

    let sendStackDuringCallback: typeof state$.value.stack.send = []
    let hmrTrackStackDuringCallback: typeof state$.value.stack.hmr_track = []

    rawParent$!.subscribe(() => {
      sendStackDuringCallback = [...state$.value.stack.send]
      hmrTrackStackDuringCallback = [...state$.value.stack.hmr_track]
      __$("level1", ($) => {
        return $("level2", () => proxy.of(2))
      })
    })

    expect({
      sendStack: sendStackDuringCallback.map((s) => s.subscription_id),
      hmrTrackStack: hmrTrackStackDuringCallback.map((t) => t.id),
      tracks: Object.keys(state$.value.store.hmr_track),
    }).toMatchInlineSnapshot(`
      {
        "hmrTrackStack": [
          "parent",
        ],
        "sendStack": [
          "6",
        ],
        "tracks": [
          "parent",
          "$ref[0]:subscription[6]:level1:level2",
        ],
      }
    `)
  })
})

describe.skip("getDanglingSubscriptions", () => {
  useTrackingTestSetup()

  it("returns subscriptions to observables not in any hmr_track.entity_id", () => {
    // Create tracked Subject - wrap in __$ so it's tracked
    const trackedSubj = new Subject<number>()
    __$("tracked", () => trackedSubj)
    const trackedEntityId = state$.value.store.hmr_track["tracked"].entity_id
    const trackedObs = state$.value.store.observable[trackedEntityId].obs_ref?.deref()

    // Create untracked Subject (not wrapped in __$)
    const untrackedSubj = new Subject<number>()

    // Subscribe to both
    trackedObs!.subscribe()
    untrackedSubj.subscribe()

    expect(state$.value.store).toMatchInlineSnapshot(`
      {
        "arg": {},
        "arg_call": {},
        "hmr_track": {
          "tracked": {
            "created_at": 0,
            "created_at_end": 0,
            "entity_id": "0",
            "entity_type": "observable",
            "id": "tracked",
            "index": 0,
            "parent_track_id": undefined,
            "prev_entity_ids": [],
            "version": 0,
          },
        },
        "observable": {
          "0": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "0",
            "name": "new Subject",
            "obs_ref": WeakRef {},
          },
          "2": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "2",
            "name": "new Subject",
            "obs_ref": WeakRef {},
          },
        },
        "operator": {},
        "operator_fun": {},
        "pipe": {},
        "send": {},
        "subscription": {
          "1": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "1",
            "is_sync": false,
            "observable_id": "0",
            "parent_subscription_id": undefined,
          },
          "3": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "3",
            "is_sync": false,
            "observable_id": "2",
            "parent_subscription_id": undefined,
          },
        },
      }
    `)
    // subscription "1" is to tracked obs "0", subscription "3" is to untracked obs "2"
    const dangling = getDanglingSubscriptions(state$.value.store)
    expect(dangling.map((s) => s.id)).toMatchInlineSnapshot(`
      [
        "3",
      ]
    `)
  })

  it("excludes already-unsubscribed subscriptions from dangling", () => {
    const subj = new Subject<number>()
    const sub = subj.subscribe()
    sub.unsubscribe()

    expect(state$.value.store.subscription).toMatchInlineSnapshot(`
      {
        "1": {
          "created_at": 0,
          "created_at_end": 0,
          "id": "1",
          "is_sync": false,
          "observable_id": "0",
          "parent_subscription_id": undefined,
          "unsubscribed_at": 0,
          "unsubscribed_at_end": 0,
        },
      }
    `)
    const dangling = getDanglingSubscriptions(state$.value.store)
    expect(dangling).toMatchInlineSnapshot(`[]`)
  })

  it("tracks orphaned subscriptions after HMR swap", () => {
    // First version - use Subject so subscription stays active
    const subj1 = new Subject<number>()
    __$("swappable", () => subj1)
    const firstEntityId = state$.value.store.hmr_track["swappable"].entity_id
    const firstObs = state$.value.store.observable[firstEntityId].obs_ref?.deref()
    firstObs!.subscribe()

    const beforeSwap = getDanglingSubscriptions(state$.value.store)
    expect(beforeSwap).toMatchInlineSnapshot(`[]`)

    // Simulate HMR - new Subject replaces old
    const subj2 = new Subject<number>()
    __$("swappable", () => subj2)

    expect(state$.value.store.hmr_track).toMatchInlineSnapshot(`
      {
        "swappable": {
          "created_at": 0,
          "created_at_end": 0,
          "entity_id": "3",
          "entity_type": "observable",
          "id": "swappable",
          "index": 0,
          "last_change_structural": false,
          "parent_track_id": undefined,
          "prev_entity_ids": [
            "0",
          ],
          "version": 1,
        },
      }
    `)
    // Old subscription to "0" is now dangling (entity_id is now "3")
    const afterSwap = getDanglingSubscriptions(state$.value.store)
    expect(afterSwap.map((s) => s.observable_id)).toMatchInlineSnapshot(`
      [
        "0",
      ]
    `)
  })
})
