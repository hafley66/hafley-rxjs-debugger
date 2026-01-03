import { BehaviorSubject, Subject } from "rxjs"
import { describe, expect, it } from "vitest"
import { state$ } from "../00.types"
import { __$ } from "./0_runtime"
import "../03_scan-accumulator"
import { useTrackingTestSetup } from "../0_test-utils"
import { proxy } from "../04.operators"
import { getDanglingSubscriptions } from "../06_queries"
import { trackedBehaviorSubject, trackedSubject } from "./3_tracked-subject"

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
        "module_id": undefined,
        "module_version": undefined,
        "parent_track_id": undefined,
        "prev_entity_ids": [],
        "stable_ref": WeakRef {},
        "version": 0,
      }
    `)
  })

  it("tracks nested scopes with child $ tracker", () => {
    __$("root", $ => {
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
          "module_id": undefined,
          "module_version": undefined,
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
        proxy.map(x => x * 2),
        proxy.take(2),
      ),
    )

    expect(state$.value.store.hmr_track["test:pipe"]).toMatchInlineSnapshot(`
      {
        "created_at": 0,
        "created_at_end": 0,
        "entity_id": "27",
        "entity_type": "observable",
        "id": "test:pipe",
        "index": 0,
        "module_id": undefined,
        "module_version": undefined,
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
        "module_id": undefined,
        "module_version": undefined,
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
    __$("test:op", $ => {
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
        "module_id": undefined,
        "module_version": undefined,
        "parent_track_id": "test:op",
        "prev_entity_ids": [],
        "version": 0,
      }
    `)
  })

  it("detects fn-only change when structure same (last_change_structural: false)", () => {
    // First execution
    __$("test:hmr", () => proxy.of(1, 2, 3).pipe(proxy.map(x => x * 2)))
    const entity1 = state$.value.store.hmr_track["test:hmr"].entity_id
    const obs1Name = state$.value.store.observable[entity1]?.name
    expect(state$.value.store.hmr_track["test:hmr"].version).toBe(0)

    // Simulate HMR: same structure, different fn body
    __$("test:hmr", () => proxy.of(1, 2, 3).pipe(proxy.map(x => x * 3)))
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
    __$("test:structural", () => proxy.of(1, 2, 3).pipe(proxy.map(x => x * 2)))
    const entity1 = state$.value.store.hmr_track["test:structural"].entity_id
    const obs1Name = state$.value.store.observable[entity1]?.name

    // Simulate HMR: added filter operator
    __$("test:structural", () =>
      proxy.of(1, 2, 3).pipe(
        proxy.map(x => x * 2),
        proxy.filter(x => x > 2),
      ),
    )

    const track = state$.value.store.hmr_track["test:structural"]
    const obs2Name = state$.value.store.observable[track.entity_id]?.name

    expect({
      obs1Name,
      obs2Name,
      version: track.version,
      structural: (track as any).last_change_structural,
    }).toMatchInlineSnapshot(`
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
      __$("level1", $ => {
        return $("level2", () => proxy.of(2))
      })
    })

    expect({
      sendStack: sendStackDuringCallback.map(s => s.subscription_id),
      hmrTrackStack: hmrTrackStackDuringCallback.map(t => t.id),
      tracks: Object.keys(state$.value.store.hmr_track),
    }).toMatchInlineSnapshot(`
      {
        "hmrTrackStack": [
          "parent",
          "parent",
        ],
        "sendStack": [
          "7",
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

describe("trackedSubject bi-sync", () => {
  useTrackingTestSetup()

  it("proxy.next forwards to inner and emits on proxy", () => {
    let rawInner: Subject<number> | undefined
    __$("biSync", () => (rawInner = new Subject<number>()))

    const ts = trackedSubject<number>("biSync")
    const innerValues: number[] = []
    const proxyValues: number[] = []

    rawInner!.subscribe(v => innerValues.push(v))
    // Use pipe to subscribe directly to proxy's emissions (not forwarded to inner)
    ;(ts as any)._subscribe({
      next: (v: number) => proxyValues.push(v),
    })

    ts.next(1)
    ts.next(2)

    expect({ innerValues, proxyValues }).toMatchInlineSnapshot(`
      {
        "innerValues": [
          1,
          2,
        ],
        "proxyValues": [
          1,
          2,
        ],
      }
    `)
  })

  it("inner.next forwards to proxy (captured raw inner)", () => {
    let rawInner: Subject<number> | undefined
    __$("innerForward", () => (rawInner = new Subject<number>()))

    const ts = trackedSubject<number>("innerForward")
    const proxyValues: number[] = []

    // Subscribe directly to proxy's internal subject
    ;(ts as any)._subscribe({
      next: (v: number) => proxyValues.push(v),
    })

    // Emit on raw inner - should forward to proxy
    rawInner!.next(1)
    rawInner!.next(2)

    expect(proxyValues).toMatchInlineSnapshot(`
      [
        1,
        2,
      ]
    `)
  })

  it("error and complete forward bidirectionally", () => {
    let rawInner: Subject<number> | undefined
    __$("errorComplete", () => (rawInner = new Subject<number>()))

    const ts = trackedSubject<number>("errorComplete")
    let innerCompleted = false
    let proxyCompleted = false

    rawInner!.subscribe({ complete: () => (innerCompleted = true) })
    ;(ts as any)._subscribe({ complete: () => (proxyCompleted = true) })

    ts.complete()

    expect({ innerCompleted, proxyCompleted }).toMatchInlineSnapshot(`
      {
        "innerCompleted": true,
        "proxyCompleted": true,
      }
    `)
  })

  it("inner.complete forwards to proxy", () => {
    let rawInner: Subject<number> | undefined
    __$("innerComplete", () => (rawInner = new Subject<number>()))

    const ts = trackedSubject<number>("innerComplete")
    let proxyCompleted = false

    ;(ts as any)._subscribe({ complete: () => (proxyCompleted = true) })

    rawInner!.complete()

    expect(proxyCompleted).toBe(true)
  })

  it("no infinite loop when proxy.next triggers inner which triggers proxy", () => {
    let rawInner: Subject<number> | undefined
    __$("noLoop", () => (rawInner = new Subject<number>()))

    const ts = trackedSubject<number>("noLoop")
    const values: number[] = []

    // Subscribe to both to check for duplicates
    rawInner!.subscribe(v => values.push(v))
    ;(ts as any)._subscribe({ next: (v: number) => values.push(v) })

    ts.next(1)

    // Should only have 2 values (one from inner, one from proxy), not infinite
    expect(values).toMatchInlineSnapshot(`
      [
        1,
        1,
      ]
    `)
  })
})

describe("trackedBehaviorSubject", () => {
  useTrackingTestSetup()

  it("getValue returns inner value", () => {
    let rawInner: BehaviorSubject<number> | undefined
    __$("bsValue", () => (rawInner = new BehaviorSubject(42)))

    const tbs = trackedBehaviorSubject<number>("bsValue", 0)

    expect(tbs.getValue()).toBe(42)
    expect(tbs.value).toBe(42)
  })

  it("proxy.next updates inner value", () => {
    let rawInner: BehaviorSubject<number> | undefined
    __$("bsNext", () => (rawInner = new BehaviorSubject(0)))

    const tbs = trackedBehaviorSubject<number>("bsNext", -1)

    tbs.next(100)

    expect(rawInner!.value).toBe(100)
    expect(tbs.value).toBe(100)
  })

  it("inner.next updates proxy value", () => {
    let rawInner: BehaviorSubject<number> | undefined
    __$("bsInnerNext", () => (rawInner = new BehaviorSubject(0)))

    const tbs = trackedBehaviorSubject<number>("bsInnerNext", -1)

    rawInner!.next(200)

    // Proxy should reflect inner's value
    expect(tbs.value).toBe(200)
  })

  it("bi-sync with next/error/complete", () => {
    let rawInner: BehaviorSubject<number> | undefined
    __$("bsBiSync", () => (rawInner = new BehaviorSubject(0)))

    const tbs = trackedBehaviorSubject<number>("bsBiSync", -1)
    const innerValues: number[] = []
    const proxyValues: number[] = []

    rawInner!.subscribe(v => innerValues.push(v))
    ;(tbs as any)._subscribe({ next: (v: number) => proxyValues.push(v) })

    tbs.next(1)
    rawInner!.next(2)

    expect({ innerValues, proxyValues }).toMatchInlineSnapshot(`
      {
        "innerValues": [
          0,
          1,
          2,
        ],
        "proxyValues": [
          0,
          1,
          2,
        ],
      }
    `)
  })
})

// NOTE: getDanglingSubscriptions requires subscriptions to be tracked.
// Subscriptions are only tracked when inside a __$ scope (track context required by shouldEmit).
// These tests are skipped pending investigation of track context isolation between tests.
describe.skip("getDanglingSubscriptions", () => {
  useTrackingTestSetup({ fakeTrack: true })

  it("subscription to current tracked entity is not dangling", () => {
    let subj: Subject<number>
    __$("tracked", () => (subj = new Subject<number>()))
    subj!.subscribe()
    expect(getDanglingSubscriptions(state$.value.store)).toMatchInlineSnapshot(`[]`)
  })

  it("detects orphaned subscription after HMR swap", () => {
    let subj1: Subject<number>
    __$("swappable", () => (subj1 = new Subject<number>()))
    subj1!.subscribe()

    __$("swappable", () => new Subject<number>())

    const dangling = getDanglingSubscriptions(state$.value.store)
    expect(dangling.length).toBe(1)
  })

  it("excludes unsubscribed from dangling", () => {
    let subj1: Subject<number>
    __$("swappable", () => (subj1 = new Subject<number>()))
    const sub = subj1!.subscribe()
    sub.unsubscribe()

    __$("swappable", () => new Subject<number>())

    expect(getDanglingSubscriptions(state$.value.store)).toMatchInlineSnapshot(`[]`)
  })
})
