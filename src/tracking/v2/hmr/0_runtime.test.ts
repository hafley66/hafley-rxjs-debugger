import { describe, expect, it } from "vitest"
import { __$ } from "./0_runtime"
import { state$ } from "../00.types"
import "../03_scan-accumulator"
import { proxy } from "../04.operators"
import { useTrackingTestSetup } from "../0_test-utils"

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
})
