import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { __$ } from "./0_runtime"
import { isEnabled$, state$ } from "../00.types"
import { resetIdCounter, setNow } from "../01_helpers"
import "../03_scan-accumulator"
import { proxy } from "../04.operators"

describe("__$ HMR runtime", () => {
  beforeEach(() => {
    resetIdCounter()
    setNow(0)
    state$.reset()
    isEnabled$.next(true)
  })

  afterEach(() => {
    resetIdCounter()
    setNow(null)
    isEnabled$.next(false)
  })

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
        "entity_id": "5",
        "entity_type": "observable",
        "id": "test:fn",
        "index": 0,
        "parent_track_id": undefined,
        "prev_entity_ids": [],
        "version": 0,
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
})
