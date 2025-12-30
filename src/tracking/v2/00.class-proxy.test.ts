import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ProxyBehaviorSubject, ProxyObservable, ProxySubject } from "./00.class-proxy"
import { state$ } from "./00.types"
import { resetIdCounter } from "./01_helpers"
import "./03_scan-accumulator"
import { proxy } from "./04.operators"

describe("Class proxy events", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(performance, "now").mockImplementation(() => Date.now())
    resetIdCounter()
    state$.set({ isEnabled: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    resetIdCounter()
    state$.set({ isEnabled: false })
  })

  it.only("from is workable", () => {
    proxy.from(proxy.of(12))

    expect(state$.value.store.observable).toMatchInlineSnapshot(`{}`)
  })

  it("tracks all 4 observable types with timestamps", () => {
    vi.setSystemTime(1000)
    const obs$ = new ProxyObservable(s => s.complete())
    vi.setSystemTime(2000)
    const subject$ = new ProxySubject()
    vi.setSystemTime(3000)
    const bsubject$ = new ProxyBehaviorSubject(42)

    expect(state$.value.store.observable).toEqual({
      "0": {
        id: "0",
        created_at: 1000,
        created_at_end: 1000,
        name: "new Observable",
        args: [expect.any(Function)],
        observable_refs: [],
      },
      "1": {
        id: "1",
        created_at: 2000,
        created_at_end: 2000,
        name: "new Subject",
        args: [],
        observable_refs: [],
      },
      "2": {
        id: "2",
        created_at: 3000,
        created_at_end: 3000,
        name: "new BehaviorSubject",
        args: [42],
        observable_refs: [],
      },
    })
    expect(state$.value.stack.observable).toEqual([])
  })

  it.only("tracks pipe lifecycle", () => {
    vi.setSystemTime(1000)
    const obs$ = new ProxyObservable<number>(s => {
      s.next(5)
    }).pipe(
      proxy.map(it => it * 2),
      proxy.filter(it => it !== 0),
      proxy.scan((sum, it) => {
        return sum + it
      }, 0),
    )

    vi.setSystemTime(2000)
    expect(state$.value.store).toMatchInlineSnapshot(`
      {
        "arg": {},
        "arg_call": {},
        "observable": {
          "0": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "0",
            "name": "new Observable",
          },
        },
        "operator": {
          "5": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "5",
            "index": 0,
            "operator_fun_id": undefined,
            "pipe_id": "1",
            "source_observable_id": "0",
            "target_observable_id": "UNKNOWN",
          },
          "6": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "6",
            "index": 1,
            "operator_fun_id": undefined,
            "pipe_id": "1",
            "source_observable_id": "UNKNOWN",
            "target_observable_id": "UNKNOWN",
          },
          "7": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "7",
            "index": 2,
            "operator_fun_id": undefined,
            "pipe_id": "1",
            "source_observable_id": "UNKNOWN",
            "target_observable_id": "UNKNOWN",
          },
        },
        "operator_fun": {
          "2": {
            "created_at": 1000,
            "id": "2",
            "name": "map",
          },
          "3": {
            "created_at": 1000,
            "id": "3",
            "name": "filter",
          },
          "4": {
            "created_at": 1000,
            "id": "4",
            "name": "scan",
          },
        },
        "pipe": {
          "1": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "1",
            "observable_id": "UNKNOWN",
            "parent_observable_id": "0",
          },
        },
        "send": {},
        "subscription": {},
      }
    `)
  })

  it("tracks subscribe/unsubscribe dual timespans", () => {
    vi.setSystemTime(1000)
    const obs$ = new ProxyObservable(s => {})

    vi.setSystemTime(2000)
    const subFn = obs$.subscribe
    expect(state$.value.stack.subscription).toEqual([
      {
        id: "1",
        created_at: 2000,
        observable_id: "0",
        is_sync: false,
      },
    ])

    vi.setSystemTime(3000)
    const sub = subFn()
    expect(state$.value.stack.subscription).toEqual([
      {
        id: "1",
        created_at: 2000,
        created_at_end: 3000,
        observable_id: "0",
        is_sync: false,
      },
    ])
    expect(state$.value.store.subscription).toEqual({
      "1": {
        id: "1",
        created_at: 2000,
        created_at_end: 3000,
        observable_id: "0",
        is_sync: false,
      },
    })

    vi.setSystemTime(4000)
    sub.unsubscribe()
    expect(state$.value.stack.subscription).toEqual([])
    expect(state$.value.store.subscription).toEqual({
      "1": {
        id: "1",
        created_at: 2000,
        created_at_end: 3000,
        unsubscribed_at: 4000,
        unsubscribed_at_end: 4000,
        observable_id: "0",
        is_sync: false,
      },
    })
  })
})
