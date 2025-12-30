import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { state$ } from "./00.types"
import { resetIdCounter, setNow } from "./01_helpers"
import "./03_scan-accumulator"
import { BehaviorSubject, lastValueFrom, Observable, Subject, tap } from "rxjs"
import { proxy } from "./04.operators"

describe("Class proxy events", () => {
  beforeEach(() => {
    resetIdCounter()
    setNow(0)
    state$.reset()
    state$.set({ isEnabled: true })
  })

  afterEach(() => {
    resetIdCounter()
    setNow(null)
    state$.set({ isEnabled: false })
  })

  it("from is workable", async () => {
    setNow(1000)
    let index = 1
    const value = await lastValueFrom(
      proxy.from(proxy.of(12, 15)).pipe(
        proxy.repeat({ delay: () => proxy.of(true), count: 2 }),
        proxy.tap({
          next: () => {
            setNow(index++ * 1000)
          },
          complete: () => {
            setNow(index++ * 1000)
          },
          error: () => {
            setNow(index++ * 1000)
          },
        }),
      ),
    )

    expect(state$.value.store).toMatchInlineSnapshot(`
      {
        "arg": {
          "1": {
            "created_at": 1000,
            "id": "1",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0",
          },
          "4": {
            "created_at": 1000,
            "id": "4",
            "is_function": true,
            "owner_id": "3",
            "path": "$args.0.delay",
          },
          "6": {
            "created_at": 1000,
            "id": "6",
            "is_function": true,
            "owner_id": "5",
            "path": "$args.0.next",
          },
          "7": {
            "created_at": 1000,
            "id": "7",
            "is_function": true,
            "owner_id": "5",
            "path": "$args.0.complete",
          },
          "8": {
            "created_at": 1000,
            "id": "8",
            "is_function": true,
            "owner_id": "5",
            "path": "$args.0.error",
          },
        },
        "arg_call": {
          "24": {
            "arg_id": "4",
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "24",
            "input_values": [
              1,
            ],
            "observable_id": "25",
            "subscription_id": "14",
          },
        },
        "observable": {
          "0": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "0",
            "name": "from",
          },
          "10": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "10",
            "name": "new Observable",
          },
          "12": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "12",
            "name": "new Observable",
          },
          "25": {
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "25",
            "name": "of",
          },
        },
        "operator": {
          "11": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "11",
            "index": 1,
            "operator_fun_id": "5",
            "pipe_id": "2",
            "source_observable_id": "10",
            "target_observable_id": "12",
          },
          "9": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "9",
            "index": 0,
            "operator_fun_id": "3",
            "pipe_id": "2",
            "source_observable_id": "0",
            "target_observable_id": "10",
          },
        },
        "operator_fun": {
          "3": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "3",
            "name": "repeat",
          },
          "5": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "5",
            "name": "tap",
          },
        },
        "pipe": {
          "2": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "2",
            "observable_id": "12",
            "parent_observable_id": "0",
          },
        },
        "send": {
          "13": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "13",
            "observable_id": "12",
            "subscription_id": "13",
            "type": "complete",
          },
          "14": {
            "created_at": 4000,
            "created_at_end": 5000,
            "id": "14",
            "observable_id": "10",
            "subscription_id": "14",
            "type": "complete",
          },
          "15": {
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "15",
            "observable_id": "0",
            "subscription_id": "15",
            "type": "complete",
          },
          "16": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "16",
            "observable_id": "0",
            "subscription_id": "15",
            "type": "next",
            "value": 12,
          },
          "17": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "17",
            "observable_id": "10",
            "subscription_id": "14",
            "type": "next",
            "value": 12,
          },
          "19": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "19",
            "observable_id": "12",
            "subscription_id": "13",
            "type": "next",
            "value": 12,
          },
          "20": {
            "created_at": 1000,
            "created_at_end": 2000,
            "id": "20",
            "observable_id": "0",
            "subscription_id": "15",
            "type": "next",
            "value": 15,
          },
          "21": {
            "created_at": 1000,
            "created_at_end": 2000,
            "id": "21",
            "observable_id": "10",
            "subscription_id": "14",
            "type": "next",
            "value": 15,
          },
          "23": {
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "23",
            "observable_id": "12",
            "subscription_id": "13",
            "type": "next",
            "value": 15,
          },
          "26": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "26",
            "observable_id": "25",
            "subscription_id": "26",
            "type": "complete",
          },
          "27": {
            "created_at": 2000,
            "created_at_end": 5000,
            "id": "27",
            "observable_id": "25",
            "subscription_id": "26",
            "type": "next",
            "value": true,
          },
          "28": {
            "created_at": 4000,
            "created_at_end": 5000,
            "id": "28",
            "observable_id": "0",
            "subscription_id": "28",
            "type": "complete",
          },
          "29": {
            "created_at": 2000,
            "created_at_end": 3000,
            "id": "29",
            "observable_id": "0",
            "subscription_id": "28",
            "type": "next",
            "value": 12,
          },
          "30": {
            "created_at": 2000,
            "created_at_end": 3000,
            "id": "30",
            "observable_id": "10",
            "subscription_id": "14",
            "type": "next",
            "value": 12,
          },
          "32": {
            "created_at": 3000,
            "created_at_end": 3000,
            "id": "32",
            "observable_id": "12",
            "subscription_id": "13",
            "type": "next",
            "value": 12,
          },
          "33": {
            "created_at": 3000,
            "created_at_end": 4000,
            "id": "33",
            "observable_id": "0",
            "subscription_id": "28",
            "type": "next",
            "value": 15,
          },
          "34": {
            "created_at": 3000,
            "created_at_end": 4000,
            "id": "34",
            "observable_id": "10",
            "subscription_id": "14",
            "type": "next",
            "value": 15,
          },
          "36": {
            "created_at": 4000,
            "created_at_end": 4000,
            "id": "36",
            "observable_id": "12",
            "subscription_id": "13",
            "type": "next",
            "value": 15,
          },
        },
        "subscription": {
          "13": {
            "created_at": 1000,
            "created_at_end": 5000,
            "id": "13",
            "is_sync": false,
            "observable_id": "12",
            "parent_subscription_id": undefined,
          },
          "14": {
            "created_at": 1000,
            "created_at_end": 5000,
            "id": "14",
            "is_sync": false,
            "observable_id": "10",
            "parent_subscription_id": "13",
          },
          "15": {
            "created_at": 1000,
            "created_at_end": 2000,
            "id": "15",
            "is_sync": false,
            "observable_id": "0",
            "parent_subscription_id": "14",
            "unsubscribed_at": 2000,
            "unsubscribed_at_end": 2000,
          },
          "26": {
            "created_at": 2000,
            "created_at_end": 5000,
            "id": "26",
            "is_sync": false,
            "observable_id": "25",
            "parent_subscription_id": "14",
          },
          "28": {
            "created_at": 2000,
            "created_at_end": 5000,
            "id": "28",
            "is_sync": false,
            "observable_id": "0",
            "parent_subscription_id": "26",
          },
        },
      }
    `)
  })

  it("tracks all 4 observable types with timestamps", () => {
    setNow(1000)
    const obs$ = new Observable(s => s.complete())
    setNow(2000)
    const subject$ = new Subject()
    setNow(3000)
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
    setNow(1000)
    const obs$ = new Observable<number>(s => {
      s.next(5)
      s.complete()
    })

    setNow(2000)
    obs$.pipe(
      (setNow(3000), proxy.map(it => it * 2)),
      (setNow(4000), proxy.filter(it => it !== 0)),
      (setNow(5000),
      proxy.scan((sum, it) => {
        return sum + it
      }, 0)),
    )

    setNow(6000)
    expect(state$.value.store).toMatchInlineSnapshot(`
      {
        "arg": {
          "3": {
            "created_at": 3000,
            "id": "3",
            "is_function": true,
            "owner_id": "2",
            "path": "$args.0",
          },
          "5": {
            "created_at": 4000,
            "id": "5",
            "is_function": true,
            "owner_id": "4",
            "path": "$args.0",
          },
          "7": {
            "created_at": 5000,
            "id": "7",
            "is_function": true,
            "owner_id": "6",
            "path": "$args.0",
          },
        },
        "arg_call": {},
        "observable": {
          "0": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "0",
            "name": "new Observable",
          },
          "11": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "11",
            "name": "new Observable",
          },
          "13": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "13",
            "name": "new Observable",
          },
          "9": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "9",
            "name": "new Observable",
          },
        },
        "operator": {
          "10": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "10",
            "index": 1,
            "operator_fun_id": "4",
            "pipe_id": "1",
            "source_observable_id": "9",
            "target_observable_id": "11",
          },
          "12": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "12",
            "index": 2,
            "operator_fun_id": "6",
            "pipe_id": "1",
            "source_observable_id": "11",
            "target_observable_id": "13",
          },
          "8": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "8",
            "index": 0,
            "operator_fun_id": "2",
            "pipe_id": "1",
            "source_observable_id": "0",
            "target_observable_id": "9",
          },
        },
        "operator_fun": {
          "2": {
            "created_at": 3000,
            "created_at_end": 3000,
            "id": "2",
            "name": "map",
          },
          "4": {
            "created_at": 4000,
            "created_at_end": 4000,
            "id": "4",
            "name": "filter",
          },
          "6": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "6",
            "name": "scan",
          },
        },
        "pipe": {
          "1": {
            "created_at": 2000,
            "created_at_end": 5000,
            "id": "1",
            "observable_id": "13",
            "parent_observable_id": "0",
          },
        },
        "send": {},
        "subscription": {},
      }
    `)
  })

  it("tracks switchMap?", async () => {
    proxy
      .of(5)
      .pipe(proxy.switchMap((val, index) => proxy.of(index + "/" + val)))
      .subscribe()
    expect(state$.value.store).toMatchInlineSnapshot(`
      {
        "arg": {
          "3": {
            "created_at": 0,
            "id": "3",
            "is_function": true,
            "owner_id": "2",
            "path": "$args.0",
          },
        },
        "arg_call": {
          "9": {
            "arg_id": "3",
            "created_at": 0,
            "created_at_end": 0,
            "id": "9",
            "input_values": [
              5,
              0,
            ],
            "observable_id": "10",
            "subscription_id": "6",
          },
        },
        "observable": {
          "0": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "0",
            "name": "of",
          },
          "10": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "10",
            "name": "of",
          },
          "5": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "5",
            "name": "new Observable",
          },
        },
        "operator": {
          "4": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "4",
            "index": 0,
            "operator_fun_id": "2",
            "pipe_id": "1",
            "source_observable_id": "0",
            "target_observable_id": "5",
          },
        },
        "operator_fun": {
          "2": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "2",
            "name": "switchMap",
          },
        },
        "pipe": {
          "1": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "1",
            "observable_id": "5",
            "parent_observable_id": "0",
          },
        },
        "send": {
          "11": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "11",
            "observable_id": "10",
            "subscription_id": "11",
            "type": "complete",
          },
          "12": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "12",
            "observable_id": "10",
            "subscription_id": "11",
            "type": "next",
            "value": "0/5",
          },
          "13": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "13",
            "observable_id": "5",
            "subscription_id": "6",
            "type": "next",
            "value": "0/5",
          },
          "6": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "6",
            "observable_id": "5",
            "subscription_id": "6",
            "type": "complete",
          },
          "7": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "7",
            "observable_id": "0",
            "subscription_id": "7",
            "type": "complete",
          },
          "8": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "8",
            "observable_id": "0",
            "subscription_id": "7",
            "type": "next",
            "value": 5,
          },
        },
        "subscription": {
          "11": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "11",
            "is_sync": false,
            "observable_id": "10",
            "parent_subscription_id": "6",
          },
          "6": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "6",
            "is_sync": false,
            "observable_id": "5",
            "parent_subscription_id": undefined,
          },
          "7": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "7",
            "is_sync": false,
            "observable_id": "0",
            "parent_subscription_id": "6",
          },
        },
      }
    `)
  })
})
