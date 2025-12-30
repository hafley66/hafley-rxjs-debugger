import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { state$ } from "./00.types"
import { resetIdCounter } from "./01_helpers"
import "./03_scan-accumulator"
import { BehaviorSubject, Observable, Subject } from "rxjs"
import { proxy } from "./04.operators"

describe("Class proxy events", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(performance, "now").mockImplementation(() => Date.now())
    resetIdCounter()
    state$.reset()
    state$.set({ isEnabled: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    resetIdCounter()
    state$.set({ isEnabled: false })
  })

  it("from is workable", () => {
    vi.setSystemTime(1000)

    proxy.from(proxy.of(12))

    expect(state$.value.store).toMatchInlineSnapshot(`
      {
        "arg": {
          "3": {
            "created_at": 1000,
            "id": "3",
            "is_function": false,
            "observable_id": "1",
            "owner_id": "1",
            "path": "$args.0",
          },
        },
        "arg_call": {},
        "observable": {
          "1": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "1",
            "name": "from",
          },
        },
        "operator": {},
        "operator_fun": {},
        "pipe": {},
        "send": {},
        "subscription": {},
      }
    `)
  })

  it("tracks all 4 observable types with timestamps", () => {
    vi.setSystemTime(1000)
    const obs$ = new Observable(s => s.complete())
    vi.setSystemTime(2000)
    const subject$ = new Subject()
    vi.setSystemTime(3000)
    const bsubject$ = new BehaviorSubject(42)

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
          "1": {
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "1",
            "name": "new Subject",
          },
          "2": {
            "created_at": 3000,
            "created_at_end": 3000,
            "id": "2",
            "name": "new BehaviorSubject",
          },
        },
        "operator": {},
        "operator_fun": {},
        "pipe": {},
        "send": {},
        "subscription": {},
      }
    `)
  })

  it("tracks pipe lifecycle", () => {
    vi.setSystemTime(1000)
    const obs$ = new Observable<number>(s => {
      s.next(5)
    })
    vi.setSystemTime(2000)
    obs$.pipe(
      (vi.setSystemTime(3000), proxy.map(it => it * 2)),
      (vi.setSystemTime(4000), proxy.filter(it => it !== 0)),
      (vi.setSystemTime(5000),
      proxy.scan((sum, it) => {
        return sum + it
      }, 0)),
    )

    vi.setSystemTime(6000)
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
          "10": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "10",
            "name": "new Observable",
          },
          "6": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "6",
            "name": "new Observable",
          },
          "8": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "8",
            "name": "new Observable",
          },
        },
        "operator": {
          "5": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "5",
            "index": 0,
            "operator_fun_id": "2",
            "pipe_id": "1",
            "source_observable_id": "0",
            "target_observable_id": "6",
          },
          "7": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "7",
            "index": 1,
            "operator_fun_id": "3",
            "pipe_id": "1",
            "source_observable_id": "6",
            "target_observable_id": "8",
          },
          "9": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "9",
            "index": 2,
            "operator_fun_id": "4",
            "pipe_id": "1",
            "source_observable_id": "8",
            "target_observable_id": "10",
          },
        },
        "operator_fun": {
          "2": {
            "created_at": 3000,
            "id": "2",
            "name": "map",
          },
          "3": {
            "created_at": 4000,
            "id": "3",
            "name": "filter",
          },
          "4": {
            "created_at": 5000,
            "id": "4",
            "name": "scan",
          },
        },
        "pipe": {
          "1": {
            "created_at": 2000,
            "created_at_end": 5000,
            "id": "1",
            "observable_id": "10",
            "parent_observable_id": "0",
          },
        },
        "send": {},
        "subscription": {},
      }
    `)
  })
})
