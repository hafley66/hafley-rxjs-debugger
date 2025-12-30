import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { state$ } from "./00.types"
import { resetIdCounter, setNow } from "./01_helpers"
import "./03_scan-accumulator"
import { BehaviorSubject, lastValueFrom, Observable, Subject, tap } from "rxjs"
import { proxy } from "./04.operators"
import { renderStaticTree } from "./05_render-tree"
import {
  getAllSends,
  getArgCallForObs,
  getArgsFor,
  getChildSubscriptions,
  getDynamicObs,
  getOperatorsIn,
  getPipesFor,
  getRootObservables,
  getSendsFor,
  getTopLevelSubscriptions,
  isRuntimeObs,
} from "./06_queries"

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
            "value": 12,
          },
          "10": {
            "created_at": 1000,
            "fn_source": "() => {
                  (0,__vite_ssr_import_2__.setNow)(index++ * 1e3);
                }",
            "id": "10",
            "is_function": true,
            "owner_id": "8",
            "path": "$args.0.complete",
          },
          "11": {
            "created_at": 1000,
            "fn_source": "() => {
                  (0,__vite_ssr_import_2__.setNow)(index++ * 1e3);
                }",
            "id": "11",
            "is_function": true,
            "owner_id": "8",
            "path": "$args.0.error",
          },
          "2": {
            "created_at": 1000,
            "id": "2",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.1",
            "value": 15,
          },
          "29": {
            "created_at": 2000,
            "id": "29",
            "is_function": false,
            "observable_id": "28",
            "owner_id": "28",
            "path": "$args.0",
            "value": true,
          },
          "3": {
            "created_at": 1000,
            "id": "3",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0",
          },
          "6": {
            "created_at": 1000,
            "fn_source": "() => __vite_ssr_import_5__.proxy.of(true)",
            "id": "6",
            "is_function": true,
            "owner_id": "5",
            "path": "$args.0.delay",
          },
          "7": {
            "created_at": 1000,
            "id": "7",
            "is_function": false,
            "owner_id": "5",
            "path": "$args.0.count",
            "value": 2,
          },
          "9": {
            "created_at": 1000,
            "fn_source": "() => {
                  (0,__vite_ssr_import_2__.setNow)(index++ * 1e3);
                }",
            "id": "9",
            "is_function": true,
            "owner_id": "8",
            "path": "$args.0.next",
          },
        },
        "arg_call": {
          "27": {
            "arg_id": "6",
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "27",
            "input_values": [
              1,
            ],
            "observable_id": "28",
            "subscription_id": "17",
          },
        },
        "observable": {
          "0": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "0",
            "name": "from",
          },
          "28": {
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "28",
            "name": "of",
          },
        },
        "operator": {
          "12": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "12",
            "index": 0,
            "operator_fun_id": "5",
            "pipe_id": "4",
            "source_observable_id": "0",
            "target_observable_id": "13",
          },
          "14": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "14",
            "index": 1,
            "operator_fun_id": "8",
            "pipe_id": "4",
            "source_observable_id": "13",
            "target_observable_id": "15",
          },
        },
        "operator_fun": {
          "5": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "5",
            "name": "repeat",
          },
          "8": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "8",
            "name": "tap",
          },
        },
        "pipe": {
          "4": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "4",
            "observable_id": "15",
            "parent_observable_id": "0",
          },
        },
        "send": {
          "16": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "16",
            "observable_id": "15",
            "subscription_id": "16",
            "type": "complete",
          },
          "17": {
            "created_at": 4000,
            "created_at_end": 5000,
            "id": "17",
            "observable_id": "13",
            "subscription_id": "17",
            "type": "complete",
          },
          "18": {
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "18",
            "observable_id": "0",
            "subscription_id": "18",
            "type": "complete",
          },
          "19": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "19",
            "observable_id": "0",
            "subscription_id": "18",
            "type": "next",
            "value": 12,
          },
          "20": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "20",
            "observable_id": "13",
            "subscription_id": "17",
            "type": "next",
            "value": 12,
          },
          "22": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "22",
            "observable_id": "15",
            "subscription_id": "16",
            "type": "next",
            "value": 12,
          },
          "23": {
            "created_at": 1000,
            "created_at_end": 2000,
            "id": "23",
            "observable_id": "0",
            "subscription_id": "18",
            "type": "next",
            "value": 15,
          },
          "24": {
            "created_at": 1000,
            "created_at_end": 2000,
            "id": "24",
            "observable_id": "13",
            "subscription_id": "17",
            "type": "next",
            "value": 15,
          },
          "26": {
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "26",
            "observable_id": "15",
            "subscription_id": "16",
            "type": "next",
            "value": 15,
          },
          "30": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "30",
            "observable_id": "28",
            "subscription_id": "30",
            "type": "complete",
          },
          "31": {
            "created_at": 2000,
            "created_at_end": 5000,
            "id": "31",
            "observable_id": "28",
            "subscription_id": "30",
            "type": "next",
            "value": true,
          },
          "32": {
            "created_at": 4000,
            "created_at_end": 5000,
            "id": "32",
            "observable_id": "0",
            "subscription_id": "32",
            "type": "complete",
          },
          "33": {
            "created_at": 2000,
            "created_at_end": 3000,
            "id": "33",
            "observable_id": "0",
            "subscription_id": "32",
            "type": "next",
            "value": 12,
          },
          "34": {
            "created_at": 2000,
            "created_at_end": 3000,
            "id": "34",
            "observable_id": "13",
            "subscription_id": "17",
            "type": "next",
            "value": 12,
          },
          "36": {
            "created_at": 3000,
            "created_at_end": 3000,
            "id": "36",
            "observable_id": "15",
            "subscription_id": "16",
            "type": "next",
            "value": 12,
          },
          "37": {
            "created_at": 3000,
            "created_at_end": 4000,
            "id": "37",
            "observable_id": "0",
            "subscription_id": "32",
            "type": "next",
            "value": 15,
          },
          "38": {
            "created_at": 3000,
            "created_at_end": 4000,
            "id": "38",
            "observable_id": "13",
            "subscription_id": "17",
            "type": "next",
            "value": 15,
          },
          "40": {
            "created_at": 4000,
            "created_at_end": 4000,
            "id": "40",
            "observable_id": "15",
            "subscription_id": "16",
            "type": "next",
            "value": 15,
          },
        },
        "subscription": {
          "16": {
            "created_at": 1000,
            "created_at_end": 5000,
            "id": "16",
            "is_sync": false,
            "observable_id": "15",
            "parent_subscription_id": undefined,
          },
          "17": {
            "created_at": 1000,
            "created_at_end": 5000,
            "id": "17",
            "is_sync": false,
            "observable_id": "13",
            "parent_subscription_id": "16",
          },
          "18": {
            "created_at": 1000,
            "created_at_end": 2000,
            "id": "18",
            "is_sync": false,
            "observable_id": "0",
            "parent_subscription_id": "17",
            "unsubscribed_at": 2000,
            "unsubscribed_at_end": 2000,
          },
          "30": {
            "created_at": 2000,
            "created_at_end": 5000,
            "id": "30",
            "is_sync": false,
            "observable_id": "28",
            "parent_subscription_id": "17",
          },
          "32": {
            "created_at": 2000,
            "created_at_end": 5000,
            "id": "32",
            "is_sync": false,
            "observable_id": "0",
            "parent_subscription_id": "30",
          },
        },
      }
    `)

    expect(renderStaticTree(state$.value.store)).toMatchInlineSnapshot(`
      "from                                                                                                                                                                                                                     // #0
        .pipe(                                                                                                                                                                                                                 // 
          repeat({ delay: () => proxy.of(true), count: 2 }),                                                                                                                                                                   // #13
          tap({ next: () => {
                  (0,setNow)(index++ * 1e3);
                }, complete: () => {
                  (0,setNow)(index++ * 1e3);
                }, error: () => {
                  (0,setNow)(index++ * 1e3);
                } }),  // #15
        )                                                                                                                                                                                                                      // -> #15"
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

    expect(renderStaticTree(state$.value.store)).toMatchInlineSnapshot(`
      "new Observable       // #0
      new Subject          // #1
      new BehaviorSubject  // #2"
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
            "fn_source": "(it2) => it2 * 2",
            "id": "3",
            "is_function": true,
            "owner_id": "2",
            "path": "$args.0",
          },
          "5": {
            "created_at": 4000,
            "fn_source": "(it2) => it2 !== 0",
            "id": "5",
            "is_function": true,
            "owner_id": "4",
            "path": "$args.0",
          },
          "7": {
            "created_at": 5000,
            "fn_source": "(sum, it2) => {
              return sum + it2;
            }",
            "id": "7",
            "is_function": true,
            "owner_id": "6",
            "path": "$args.0",
          },
          "8": {
            "created_at": 5000,
            "id": "8",
            "is_function": false,
            "owner_id": "6",
            "path": "$args.1",
            "value": 0,
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
        },
        "operator": {
          "11": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "11",
            "index": 1,
            "operator_fun_id": "4",
            "pipe_id": "1",
            "source_observable_id": "10",
            "target_observable_id": "12",
          },
          "13": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "13",
            "index": 2,
            "operator_fun_id": "6",
            "pipe_id": "1",
            "source_observable_id": "12",
            "target_observable_id": "14",
          },
          "9": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "9",
            "index": 0,
            "operator_fun_id": "2",
            "pipe_id": "1",
            "source_observable_id": "0",
            "target_observable_id": "10",
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
            "observable_id": "14",
            "parent_observable_id": "0",
          },
        },
        "send": {},
        "subscription": {},
      }
    `)

    expect(renderStaticTree(state$.value.store)).toMatchInlineSnapshot(`
      "new Observable                                                   // #0
        .pipe(                                                         // 
          map((it2) => it2 * 2),                                       // #10
          filter((it2) => it2 !== 0),                                  // #12
          scan((sum, it2) => {
              return sum + it2;
            }, 0),  // #14
        )                                                              // -> #14"
    `)
  })

  it("tracks switchMap?", async () => {
    proxy
      .of(5)
      .pipe(proxy.switchMap((val, index) => proxy.of(index + "/" + val)))
      .subscribe()

    expect(renderStaticTree(state$.value.store)).toMatchInlineSnapshot(`
      "of                                                           // #0
        .pipe(                                                     // 
          switchMap((val, index) => proxy.of(index + "/" + val)),  // #6
        )                                                          // -> #6"
    `)

    expect(state$.value.store).toMatchInlineSnapshot(`
      {
        "arg": {
          "1": {
            "created_at": 0,
            "id": "1",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0",
            "value": 5,
          },
          "12": {
            "created_at": 0,
            "id": "12",
            "is_function": false,
            "observable_id": "11",
            "owner_id": "11",
            "path": "$args.0",
            "value": "0/5",
          },
          "4": {
            "created_at": 0,
            "fn_source": "(val, index) => __vite_ssr_import_5__.proxy.of(index + "/" + val)",
            "id": "4",
            "is_function": true,
            "owner_id": "3",
            "path": "$args.0",
          },
        },
        "arg_call": {
          "10": {
            "arg_id": "4",
            "created_at": 0,
            "created_at_end": 0,
            "id": "10",
            "input_values": [
              5,
              0,
            ],
            "observable_id": "11",
            "subscription_id": "7",
          },
        },
        "observable": {
          "0": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "0",
            "name": "of",
          },
          "11": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "11",
            "name": "of",
          },
        },
        "operator": {
          "5": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "5",
            "index": 0,
            "operator_fun_id": "3",
            "pipe_id": "2",
            "source_observable_id": "0",
            "target_observable_id": "6",
          },
        },
        "operator_fun": {
          "3": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "3",
            "name": "switchMap",
          },
        },
        "pipe": {
          "2": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "2",
            "observable_id": "6",
            "parent_observable_id": "0",
          },
        },
        "send": {
          "13": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "13",
            "observable_id": "11",
            "subscription_id": "13",
            "type": "complete",
          },
          "14": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "14",
            "observable_id": "11",
            "subscription_id": "13",
            "type": "next",
            "value": "0/5",
          },
          "15": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "15",
            "observable_id": "6",
            "subscription_id": "7",
            "type": "next",
            "value": "0/5",
          },
          "7": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "7",
            "observable_id": "6",
            "subscription_id": "7",
            "type": "complete",
          },
          "8": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "8",
            "observable_id": "0",
            "subscription_id": "8",
            "type": "complete",
          },
          "9": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "9",
            "observable_id": "0",
            "subscription_id": "8",
            "type": "next",
            "value": 5,
          },
        },
        "subscription": {
          "13": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "13",
            "is_sync": false,
            "observable_id": "11",
            "parent_subscription_id": "7",
          },
          "7": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "7",
            "is_sync": false,
            "observable_id": "6",
            "parent_subscription_id": undefined,
          },
          "8": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "8",
            "is_sync": false,
            "observable_id": "0",
            "parent_subscription_id": "7",
          },
        },
      }
    `)
  })

  it("tracks share", () => {
    const shared$ = proxy.of(1, 2).pipe(proxy.share())
    shared$.subscribe()
    shared$.subscribe()

    expect(renderStaticTree(state$.value.store)).toMatchInlineSnapshot(`
      "of            // #0
        .pipe(      // 
          share(),  // #6
        )           // -> #6
      new Subject   // #8
      new Subject   // #18"
    `)
  })

  it("tracks 2 root observables", () => {
    const a$ = proxy.of(1).pipe(proxy.map(x => x * 2))
    const b$ = proxy.of(2).pipe(proxy.filter(x => x > 0))

    expect(renderStaticTree(state$.value.store)).toMatchInlineSnapshot(`
      "of                         // #0
        .pipe(                   // 
          map((x) => x * 2),     // #6
        )                        // -> #6
      of                         // #7
        .pipe(                   // 
          filter((x) => x > 0),  // #13
        )                        // -> #13"
    `)
  })

  it("tracks observable refs across pipes", () => {
    const a$ = proxy.of(1).pipe(proxy.map(x => x * 2))
    const b$ = proxy.of(2).pipe(proxy.filter(x => x > 0))
    const c$ = a$.pipe(proxy.switchMap(() => b$))

    expect(state$.value.store.pipe).toMatchInlineSnapshot(`
      {
        "14": {
          "created_at": 0,
          "created_at_end": 0,
          "id": "14",
          "observable_id": "18",
          "parent_observable_id": "6",
        },
        "2": {
          "created_at": 0,
          "created_at_end": 0,
          "id": "2",
          "observable_id": "6",
          "parent_observable_id": "0",
        },
        "9": {
          "created_at": 0,
          "created_at_end": 0,
          "id": "9",
          "observable_id": "13",
          "parent_observable_id": "7",
        },
      }
    `)
    expect(renderStaticTree(state$.value.store)).toMatchInlineSnapshot(`
      "of                         // #0
        .pipe(                   // 
          map((x) => x * 2),     // #6
        )                        // -> #6
      of                         // #7
        .pipe(                   // 
          filter((x) => x > 0),  // #13
        )                        // -> #13
      #6                         // 
        .pipe(                   // 
          switchMap(() => b$),   // #18
        )                        // -> #18"
    `)
  })
})

describe("06_queries", () => {
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

  it("getRootObservables excludes operator targets and runtime obs", () => {
    proxy
      .of(5)
      .pipe(proxy.switchMap(val => proxy.of(val * 2)))
      .subscribe()

    const roots = getRootObservables(state$.value.store)
    expect(roots.map(r => ({ id: r.id, name: r.name }))).toMatchInlineSnapshot(`
      [
        {
          "id": "0",
          "name": "of",
        },
      ]
    `)
  })

  it("getPipesFor returns pipes for observable", () => {
    proxy.of(1).pipe(proxy.map(x => x * 2))

    const store = state$.value.store
    const roots = getRootObservables(store)
    const pipes = getPipesFor(store, roots[0]!.id)

    expect(pipes.map(p => ({ id: p.id, parent_observable_id: p.parent_observable_id }))).toMatchInlineSnapshot(`
      [
        {
          "id": "2",
          "parent_observable_id": "0",
        },
      ]
    `)
  })

  it("getOperatorsIn returns operators sorted by index", () => {
    proxy.of(1).pipe(
      proxy.map(x => x * 2),
      proxy.filter(x => x > 0),
    )

    const store = state$.value.store
    const pipeId = Object.keys(store.pipe)[0]!
    const operators = getOperatorsIn(store, pipeId)

    expect(operators.map(op => ({ index: op.index, operator_fun_id: op.operator_fun_id }))).toMatchInlineSnapshot(`
      [
        {
          "index": 0,
          "operator_fun_id": "3",
        },
        {
          "index": 1,
          "operator_fun_id": "5",
        },
      ]
    `)
  })

  it("getArgsFor returns args for operator_fun", () => {
    proxy.of(1).pipe(proxy.scan((acc, x) => acc + x, 100))

    const store = state$.value.store
    const opFunId = Object.keys(store.operator_fun)[0]!
    const args = getArgsFor(store, opFunId)

    expect(args.map(a => ({ path: a.path, is_function: a.is_function, value: a.value }))).toMatchInlineSnapshot(`
      [
        {
          "is_function": true,
          "path": "$args.0",
          "value": undefined,
        },
        {
          "is_function": false,
          "path": "$args.1",
          "value": 100,
        },
      ]
    `)
  })

  it("getTopLevelSubscriptions returns subs with no parent", () => {
    proxy.of(1).subscribe()
    proxy.of(2).subscribe()

    const topLevel = getTopLevelSubscriptions(state$.value.store)

    expect(
      topLevel.map(s => ({ id: s.id, observable_id: s.observable_id, parent: s.parent_subscription_id })),
    ).toMatchInlineSnapshot(`
      [
        {
          "id": "2",
          "observable_id": "0",
          "parent": undefined,
        },
        {
          "id": "6",
          "observable_id": "4",
          "parent": undefined,
        },
      ]
    `)
  })

  it("getChildSubscriptions returns children of a parent sub", () => {
    proxy
      .of(1)
      .pipe(proxy.switchMap(() => proxy.of(2)))
      .subscribe()

    const store = state$.value.store
    const topLevel = getTopLevelSubscriptions(store)
    const children = getChildSubscriptions(store, topLevel[0]!.id)

    expect(children.map(c => ({ id: c.id, parent: c.parent_subscription_id }))).toMatchInlineSnapshot(`
      [
        {
          "id": "8",
          "parent": "7",
        },
        {
          "id": "13",
          "parent": "7",
        },
      ]
    `)
  })

  it("getSendsFor returns sends for a subscription", () => {
    proxy.of(1, 2).subscribe()

    const store = state$.value.store
    const topLevel = getTopLevelSubscriptions(store)
    const sends = getSendsFor(store, topLevel[0]!.id)

    expect(sends).toMatchInlineSnapshot(`
      [
        {
          "created_at": 0,
          "created_at_end": 0,
          "id": "3",
          "observable_id": "0",
          "subscription_id": "3",
          "type": "complete",
        },
        {
          "created_at": 0,
          "created_at_end": 0,
          "id": "4",
          "observable_id": "0",
          "subscription_id": "3",
          "type": "next",
          "value": 1,
        },
        {
          "created_at": 0,
          "created_at_end": 0,
          "id": "5",
          "observable_id": "0",
          "subscription_id": "3",
          "type": "next",
          "value": 2,
        },
      ]
    `)
  })

  it("getAllSends returns all sends sorted by time", () => {
    setNow(100)
    proxy.of(1).subscribe()
    setNow(200)
    proxy.of(2).subscribe()

    const sends = getAllSends(state$.value.store)

    expect(sends.map(s => ({ created_at: s.created_at, type: s.type, value: s.value }))).toMatchInlineSnapshot(`
      [
        {
          "created_at": 100,
          "type": "complete",
          "value": undefined,
        },
        {
          "created_at": 100,
          "type": "next",
          "value": 1,
        },
        {
          "created_at": 200,
          "type": "complete",
          "value": undefined,
        },
        {
          "created_at": 200,
          "type": "next",
          "value": 2,
        },
      ]
    `)
  })

  it("getDynamicObs returns observables created by arg during subscription", () => {
    proxy
      .of(5)
      .pipe(proxy.switchMap(val => proxy.of(val * 2)))
      .subscribe()

    const store = state$.value.store
    const switchMapArg = Object.values(store.arg).find(a => a.is_function)!
    const dynamicObs = getDynamicObs(store, switchMapArg.id)

    expect(dynamicObs.map(o => ({ id: o!.id, name: o!.name }))).toMatchInlineSnapshot(`
      [
        {
          "id": "11",
          "name": "of",
        },
      ]
    `)
  })

  it("isRuntimeObs identifies runtime vs static observables", () => {
    proxy
      .of(5)
      .pipe(proxy.switchMap(val => proxy.of(val * 2)))
      .subscribe()

    const store = state$.value.store
    const roots = getRootObservables(store)
    const argCall = Object.values(store.arg_call)[0]!

    expect({
      rootIsRuntime: isRuntimeObs(store, roots[0]!.id),
      dynamicIsRuntime: isRuntimeObs(store, argCall.observable_id!),
    }).toMatchInlineSnapshot(`
      {
        "dynamicIsRuntime": true,
        "rootIsRuntime": false,
      }
    `)
  })

  it("getArgCallForObs returns the arg_call that created an observable", () => {
    proxy
      .of(5)
      .pipe(proxy.switchMap(val => proxy.of(val * 2)))
      .subscribe()

    const store = state$.value.store
    const argCall = Object.values(store.arg_call)[0]!
    const found = getArgCallForObs(store, argCall.observable_id!)

    expect({ id: found!.id, arg_id: found!.arg_id, observable_id: found!.observable_id }).toMatchInlineSnapshot(`
      {
        "arg_id": "4",
        "id": "10",
        "observable_id": "11",
      }
    `)
  })
})
