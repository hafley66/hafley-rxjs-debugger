import { describe, expect, it } from "vitest"
import { state$ } from "./00.types"
import { setNow } from "./01_helpers"
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
import { useTrackingTestSetup } from "./0_test-utils"

describe("Class proxy events", () => {
  useTrackingTestSetup(true)

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
            "path": "$args.0.0",
            "value": 12,
          },
          "10": {
            "created_at": 1000,
            "id": "10",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0",
          },
          "11": {
            "created_at": 1000,
            "id": "11",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0",
          },
          "14": {
            "created_at": 1000,
            "fn_ref": WeakRef {},
            "fn_source": "() => __vite_ssr_import_5__.proxy.of(true)",
            "id": "14",
            "is_function": true,
            "owner_id": "13",
            "path": "$args.0.delay",
          },
          "15": {
            "created_at": 1000,
            "id": "15",
            "is_function": false,
            "owner_id": "13",
            "path": "$args.0.count",
            "value": 2,
          },
          "17": {
            "created_at": 1000,
            "fn_ref": WeakRef {},
            "fn_source": "(...callArgs) => {
            const id = (0,__vite_ssr_import_3__.createId)();
            __vite_ssr_import_2__._observableEvents$.next({
              type: "arg-call",
              id,
              arg_id,
              args: callArgs
            });
            const fn = __vite_ssr_import_2__.state$.value.store.arg[arg_id]?.fn_ref?.deref();
            const out = fn ? fn(...callArgs) : void 0;
            __vite_ssr_import_2__._observableEvents$.next({
              type: "arg-call-return",
              id,
              observable_id: __vite_ssr_import_3__.observableIdMap.get(out) ?? "UNKNOWN"
            });
            return out;
          }",
            "id": "17",
            "is_function": true,
            "owner_id": "16",
            "path": "$args.0.delay",
          },
          "18": {
            "created_at": 1000,
            "id": "18",
            "is_function": false,
            "owner_id": "16",
            "path": "$args.0.count",
            "value": 2,
          },
          "2": {
            "created_at": 1000,
            "id": "2",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0.1",
            "value": 15,
          },
          "20": {
            "created_at": 1000,
            "fn_ref": WeakRef {},
            "fn_source": "() => {
                  (0,__vite_ssr_import_2__.setNow)(index++ * 1e3);
                }",
            "id": "20",
            "is_function": true,
            "owner_id": "19",
            "path": "$args.0.next",
          },
          "21": {
            "created_at": 1000,
            "fn_ref": WeakRef {},
            "fn_source": "() => {
                  (0,__vite_ssr_import_2__.setNow)(index++ * 1e3);
                }",
            "id": "21",
            "is_function": true,
            "owner_id": "19",
            "path": "$args.0.complete",
          },
          "22": {
            "created_at": 1000,
            "fn_ref": WeakRef {},
            "fn_source": "() => {
                  (0,__vite_ssr_import_2__.setNow)(index++ * 1e3);
                }",
            "id": "22",
            "is_function": true,
            "owner_id": "19",
            "path": "$args.0.error",
          },
          "24": {
            "created_at": 1000,
            "fn_ref": WeakRef {},
            "fn_source": "(...callArgs) => {
            const id = (0,__vite_ssr_import_3__.createId)();
            __vite_ssr_import_2__._observableEvents$.next({
              type: "arg-call",
              id,
              arg_id,
              args: callArgs
            });
            const fn = __vite_ssr_import_2__.state$.value.store.arg[arg_id]?.fn_ref?.deref();
            const out = fn ? fn(...callArgs) : void 0;
            __vite_ssr_import_2__._observableEvents$.next({
              type: "arg-call-return",
              id,
              observable_id: __vite_ssr_import_3__.observableIdMap.get(out) ?? "UNKNOWN"
            });
            return out;
          }",
            "id": "24",
            "is_function": true,
            "owner_id": "23",
            "path": "$args.0.next",
          },
          "25": {
            "created_at": 1000,
            "fn_ref": WeakRef {},
            "fn_source": "(...callArgs) => {
            const id = (0,__vite_ssr_import_3__.createId)();
            __vite_ssr_import_2__._observableEvents$.next({
              type: "arg-call",
              id,
              arg_id,
              args: callArgs
            });
            const fn = __vite_ssr_import_2__.state$.value.store.arg[arg_id]?.fn_ref?.deref();
            const out = fn ? fn(...callArgs) : void 0;
            __vite_ssr_import_2__._observableEvents$.next({
              type: "arg-call-return",
              id,
              observable_id: __vite_ssr_import_3__.observableIdMap.get(out) ?? "UNKNOWN"
            });
            return out;
          }",
            "id": "25",
            "is_function": true,
            "owner_id": "23",
            "path": "$args.0.complete",
          },
          "26": {
            "created_at": 1000,
            "fn_ref": WeakRef {},
            "fn_source": "(...callArgs) => {
            const id = (0,__vite_ssr_import_3__.createId)();
            __vite_ssr_import_2__._observableEvents$.next({
              type: "arg-call",
              id,
              arg_id,
              args: callArgs
            });
            const fn = __vite_ssr_import_2__.state$.value.store.arg[arg_id]?.fn_ref?.deref();
            const out = fn ? fn(...callArgs) : void 0;
            __vite_ssr_import_2__._observableEvents$.next({
              type: "arg-call-return",
              id,
              observable_id: __vite_ssr_import_3__.observableIdMap.get(out) ?? "UNKNOWN"
            });
            return out;
          }",
            "id": "26",
            "is_function": true,
            "owner_id": "23",
            "path": "$args.0.error",
          },
          "3": {
            "created_at": 1000,
            "id": "3",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0.0",
            "value": 12,
          },
          "4": {
            "created_at": 1000,
            "id": "4",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0.1",
            "value": 15,
          },
          "5": {
            "created_at": 1000,
            "id": "5",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0",
            "value": 12,
          },
          "6": {
            "created_at": 1000,
            "id": "6",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.1",
            "value": 15,
          },
          "60": {
            "created_at": 2000,
            "id": "60",
            "is_function": false,
            "observable_id": "59",
            "owner_id": "59",
            "path": "$args.0.0",
            "value": true,
          },
          "61": {
            "created_at": 2000,
            "id": "61",
            "is_function": false,
            "observable_id": "59",
            "owner_id": "59",
            "path": "$args.0.0",
            "value": true,
          },
          "62": {
            "created_at": 2000,
            "id": "62",
            "is_function": false,
            "observable_id": "59",
            "owner_id": "59",
            "path": "$args.0",
            "value": true,
          },
          "63": {
            "created_at": 2000,
            "id": "63",
            "is_function": false,
            "observable_id": "59",
            "owner_id": "59",
            "path": "$args.0",
            "value": true,
          },
          "64": {
            "created_at": 2000,
            "id": "64",
            "is_function": false,
            "observable_id": "59",
            "owner_id": "59",
            "path": "$args.0",
          },
          "7": {
            "created_at": 1000,
            "id": "7",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0",
            "value": 12,
          },
          "8": {
            "created_at": 1000,
            "id": "8",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.1",
            "value": 15,
          },
          "9": {
            "created_at": 1000,
            "id": "9",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0",
          },
        },
        "arg_call": {
          "57": {
            "arg_id": "17",
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "57",
            "input_values": [
              1,
            ],
            "observable_id": "59",
            "subscription_id": "36",
          },
          "58": {
            "arg_id": "14",
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "58",
            "input_values": [
              1,
            ],
            "observable_id": "59",
            "subscription_id": "36",
          },
        },
        "hmr_module": {},
        "hmr_track": {},
        "observable": {
          "0": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "0",
            "name": "from($ref[0])",
            "obs_ref": WeakRef {},
          },
          "29": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "29",
            "name": "from($ref[0]).repeat({count:2,delay:fn})",
            "obs_ref": WeakRef {},
          },
          "32": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "32",
            "name": "from($ref[0]).repeat({count:2,delay:fn}).tap({complete:fn,error:fn,next:fn})",
            "obs_ref": WeakRef {},
          },
          "59": {
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "59",
            "name": "innerFrom($ref[59])",
            "obs_ref": WeakRef {},
          },
        },
        "operator": {
          "27": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "27",
            "index": 0,
            "operator_fun_id": "UNKNOWN",
            "pipe_id": "12",
            "source_observable_id": "0",
            "target_observable_id": "29",
          },
          "28": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "28",
            "index": 0,
            "operator_fun_id": "13",
            "pipe_id": "12",
            "source_observable_id": "0",
            "target_observable_id": "29",
          },
          "30": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "30",
            "index": 1,
            "operator_fun_id": "UNKNOWN",
            "pipe_id": "12",
            "source_observable_id": "29",
            "target_observable_id": "32",
          },
          "31": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "31",
            "index": 1,
            "operator_fun_id": "19",
            "pipe_id": "12",
            "source_observable_id": "29",
            "target_observable_id": "32",
          },
        },
        "operator_fun": {
          "13": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "13",
            "name": "repeat({count:2,delay:fn})",
          },
          "16": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "16",
            "name": "repeat({count:2,delay:fn})",
          },
          "19": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "19",
            "name": "tap({complete:fn,error:fn,next:fn})",
          },
          "23": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "23",
            "name": "tap({complete:fn,error:fn,next:fn})",
          },
        },
        "pipe": {
          "12": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "12",
            "observable_id": "32",
            "parent_observable_id": "0",
          },
        },
        "send": {},
        "subscription": {
          "33": {
            "created_at": 1000,
            "created_at_end": 5000,
            "id": "33",
            "is_sync": false,
            "module_id": undefined,
            "observable_id": "32",
            "parent_subscription_id": undefined,
          },
          "34": {
            "created_at": 1000,
            "created_at_end": 5000,
            "id": "34",
            "is_sync": false,
            "module_id": undefined,
            "observable_id": "32",
            "parent_subscription_id": "33",
          },
          "35": {
            "created_at": 1000,
            "created_at_end": 5000,
            "id": "35",
            "is_sync": false,
            "module_id": undefined,
            "observable_id": "29",
            "parent_subscription_id": "34",
          },
          "36": {
            "created_at": 1000,
            "created_at_end": 5000,
            "id": "36",
            "is_sync": false,
            "module_id": undefined,
            "observable_id": "29",
            "parent_subscription_id": "35",
          },
          "37": {
            "created_at": 1000,
            "created_at_end": 2000,
            "id": "37",
            "is_sync": false,
            "module_id": undefined,
            "observable_id": "0",
            "parent_subscription_id": "36",
          },
          "38": {
            "created_at": 1000,
            "created_at_end": 2000,
            "id": "38",
            "is_sync": false,
            "module_id": undefined,
            "observable_id": "0",
            "parent_subscription_id": "37",
            "unsubscribed_at": 2000,
            "unsubscribed_at_end": 2000,
          },
          "65": {
            "created_at": 2000,
            "created_at_end": 5000,
            "id": "65",
            "is_sync": false,
            "module_id": undefined,
            "observable_id": "59",
            "parent_subscription_id": "36",
          },
          "66": {
            "created_at": 2000,
            "created_at_end": 5000,
            "id": "66",
            "is_sync": false,
            "module_id": undefined,
            "observable_id": "59",
            "parent_subscription_id": "65",
          },
          "69": {
            "created_at": 2000,
            "created_at_end": 5000,
            "id": "69",
            "is_sync": false,
            "module_id": undefined,
            "observable_id": "0",
            "parent_subscription_id": "66",
          },
          "70": {
            "created_at": 2000,
            "created_at_end": 5000,
            "id": "70",
            "is_sync": false,
            "module_id": undefined,
            "observable_id": "0",
            "parent_subscription_id": "69",
          },
        },
      }
    `)

    expect(renderStaticTree(state$.value.store)).toMatchInlineSnapshot(`
      "from($ref[0])                                                                                                                                                                                                                                            // #0
        .pipe(                                                                                                                                                                                                                                                 // 
          op(),                                                                                                                                                                                                                                                // #29
          repeat({count:2,delay:fn})({ delay: () => proxy.of(true), count: 2 }),                                                                                                                                                                               // #29
          op(),                                                                                                                                                                                                                                                // #32
          tap({complete:fn,error:fn,next:fn})({ next: () => {
                  (0,setNow)(index++ * 1e3);
                }, complete: () => {
                  (0,setNow)(index++ * 1e3);
                }, error: () => {
                  (0,setNow)(index++ * 1e3);
                } }),  // #32
        )                                                                                                                                                                                                                                                      // -> #32"
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
        "hmr_module": {},
        "hmr_track": {},
        "observable": {
          "0": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "0",
            "name": "new Observable",
            "obs_ref": WeakRef {},
          },
          "1": {
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "1",
            "name": "new Subject",
            "obs_ref": WeakRef {},
          },
          "2": {
            "created_at": 3000,
            "created_at_end": 3000,
            "id": "2",
            "name": "new BehaviorSubject",
            "obs_ref": WeakRef {},
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
          "11": {
            "created_at": 5000,
            "fn_ref": WeakRef {},
            "fn_source": "(sum, it2) => {
              return sum + it2;
            }",
            "id": "11",
            "is_function": true,
            "owner_id": "10",
            "path": "$args.0",
          },
          "12": {
            "created_at": 5000,
            "id": "12",
            "is_function": false,
            "owner_id": "10",
            "path": "$args.1",
            "value": 0,
          },
          "14": {
            "created_at": 5000,
            "fn_ref": WeakRef {},
            "fn_source": "(...callArgs) => {
            const id = (0,__vite_ssr_import_3__.createId)();
            __vite_ssr_import_2__._observableEvents$.next({
              type: "arg-call",
              id,
              arg_id,
              args: callArgs
            });
            const fn = __vite_ssr_import_2__.state$.value.store.arg[arg_id]?.fn_ref?.deref();
            const out = fn ? fn(...callArgs) : void 0;
            __vite_ssr_import_2__._observableEvents$.next({
              type: "arg-call-return",
              id,
              observable_id: __vite_ssr_import_3__.observableIdMap.get(out) ?? "UNKNOWN"
            });
            return out;
          }",
            "id": "14",
            "is_function": true,
            "owner_id": "13",
            "path": "$args.0",
          },
          "15": {
            "created_at": 5000,
            "id": "15",
            "is_function": false,
            "owner_id": "13",
            "path": "$args.1",
            "value": 0,
          },
          "17": {
            "created_at": 5000,
            "fn_ref": WeakRef {},
            "fn_source": "(...callArgs) => {
            const id = (0,__vite_ssr_import_3__.createId)();
            __vite_ssr_import_2__._observableEvents$.next({
              type: "arg-call",
              id,
              arg_id,
              args: callArgs
            });
            const fn = __vite_ssr_import_2__.state$.value.store.arg[arg_id]?.fn_ref?.deref();
            const out = fn ? fn(...callArgs) : void 0;
            __vite_ssr_import_2__._observableEvents$.next({
              type: "arg-call-return",
              id,
              observable_id: __vite_ssr_import_3__.observableIdMap.get(out) ?? "UNKNOWN"
            });
            return out;
          }",
            "id": "17",
            "is_function": true,
            "owner_id": "16",
            "path": "$args.0",
          },
          "18": {
            "created_at": 5000,
            "id": "18",
            "is_function": false,
            "owner_id": "16",
            "path": "$args.1",
            "value": 0,
          },
          "19": {
            "created_at": 5000,
            "id": "19",
            "is_function": false,
            "owner_id": "16",
            "path": "$args.2",
            "value": true,
          },
          "20": {
            "created_at": 5000,
            "id": "20",
            "is_function": false,
            "owner_id": "16",
            "path": "$args.3",
            "value": true,
          },
          "3": {
            "created_at": 3000,
            "fn_ref": WeakRef {},
            "fn_source": "(it2) => it2 * 2",
            "id": "3",
            "is_function": true,
            "owner_id": "2",
            "path": "$args.0",
          },
          "5": {
            "created_at": 3000,
            "fn_ref": WeakRef {},
            "fn_source": "(...callArgs) => {
            const id = (0,__vite_ssr_import_3__.createId)();
            __vite_ssr_import_2__._observableEvents$.next({
              type: "arg-call",
              id,
              arg_id,
              args: callArgs
            });
            const fn = __vite_ssr_import_2__.state$.value.store.arg[arg_id]?.fn_ref?.deref();
            const out = fn ? fn(...callArgs) : void 0;
            __vite_ssr_import_2__._observableEvents$.next({
              type: "arg-call-return",
              id,
              observable_id: __vite_ssr_import_3__.observableIdMap.get(out) ?? "UNKNOWN"
            });
            return out;
          }",
            "id": "5",
            "is_function": true,
            "owner_id": "4",
            "path": "$args.0",
          },
          "7": {
            "created_at": 4000,
            "fn_ref": WeakRef {},
            "fn_source": "(it2) => it2 !== 0",
            "id": "7",
            "is_function": true,
            "owner_id": "6",
            "path": "$args.0",
          },
          "9": {
            "created_at": 4000,
            "fn_ref": WeakRef {},
            "fn_source": "(...callArgs) => {
            const id = (0,__vite_ssr_import_3__.createId)();
            __vite_ssr_import_2__._observableEvents$.next({
              type: "arg-call",
              id,
              arg_id,
              args: callArgs
            });
            const fn = __vite_ssr_import_2__.state$.value.store.arg[arg_id]?.fn_ref?.deref();
            const out = fn ? fn(...callArgs) : void 0;
            __vite_ssr_import_2__._observableEvents$.next({
              type: "arg-call-return",
              id,
              observable_id: __vite_ssr_import_3__.observableIdMap.get(out) ?? "UNKNOWN"
            });
            return out;
          }",
            "id": "9",
            "is_function": true,
            "owner_id": "8",
            "path": "$args.0",
          },
        },
        "arg_call": {},
        "hmr_module": {},
        "hmr_track": {},
        "observable": {
          "0": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "0",
            "name": "new Observable",
            "obs_ref": WeakRef {},
          },
          "23": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "23",
            "name": "new Observable.map(fn)",
            "obs_ref": WeakRef {},
          },
          "26": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "26",
            "name": "new Observable.map(fn).filter(fn)",
            "obs_ref": WeakRef {},
          },
          "29": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "29",
            "name": "new Observable.map(fn).filter(fn).scan(fn,0)",
            "obs_ref": WeakRef {},
          },
        },
        "operator": {
          "21": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "21",
            "index": 0,
            "operator_fun_id": "UNKNOWN",
            "pipe_id": "1",
            "source_observable_id": "0",
            "target_observable_id": "23",
          },
          "22": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "22",
            "index": 0,
            "operator_fun_id": "2",
            "pipe_id": "1",
            "source_observable_id": "0",
            "target_observable_id": "23",
          },
          "24": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "24",
            "index": 1,
            "operator_fun_id": "UNKNOWN",
            "pipe_id": "1",
            "source_observable_id": "23",
            "target_observable_id": "26",
          },
          "25": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "25",
            "index": 1,
            "operator_fun_id": "6",
            "pipe_id": "1",
            "source_observable_id": "23",
            "target_observable_id": "26",
          },
          "27": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "27",
            "index": 2,
            "operator_fun_id": "UNKNOWN",
            "pipe_id": "1",
            "source_observable_id": "26",
            "target_observable_id": "29",
          },
          "28": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "28",
            "index": 2,
            "operator_fun_id": "10",
            "pipe_id": "1",
            "source_observable_id": "26",
            "target_observable_id": "29",
          },
        },
        "operator_fun": {
          "10": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "10",
            "name": "scan(fn,0)",
          },
          "13": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "13",
            "name": "scan(fn,0)",
          },
          "16": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "16",
            "name": "scanInternals(fn,0,true,true)",
          },
          "2": {
            "created_at": 3000,
            "created_at_end": 3000,
            "id": "2",
            "name": "map(fn)",
          },
          "4": {
            "created_at": 3000,
            "created_at_end": 3000,
            "id": "4",
            "name": "map(fn)",
          },
          "6": {
            "created_at": 4000,
            "created_at_end": 4000,
            "id": "6",
            "name": "filter(fn)",
          },
          "8": {
            "created_at": 4000,
            "created_at_end": 4000,
            "id": "8",
            "name": "filter(fn)",
          },
        },
        "pipe": {
          "1": {
            "created_at": 2000,
            "created_at_end": 5000,
            "id": "1",
            "observable_id": "29",
            "parent_observable_id": "0",
          },
        },
        "send": {},
        "subscription": {},
      }
    `)

    expect(renderStaticTree(state$.value.store)).toMatchInlineSnapshot(`
      "new Observable                                                         // #0
        .pipe(                                                               // 
          op(),                                                              // #23
          map(fn)((it2) => it2 * 2),                                         // #23
          op(),                                                              // #26
          filter(fn)((it2) => it2 !== 0),                                    // #26
          op(),                                                              // #29
          scan(fn,0)((sum, it2) => {
              return sum + it2;
            }, 0),  // #29
        )                                                                    // -> #29"
    `)
  })

  it("pipe output observable should be in store", () => {
    const source$ = proxy.of(1, 2, 3)
    const piped$ = source$.pipe(proxy.map((x) => x * 2))

    const pipeEntry = Object.values(state$.value.store.pipe)[0]
    const operatorEntry = Object.values(state$.value.store.operator)[0]

    const sourceObs = state$.value.store.observable[operatorEntry!.source_observable_id]
    const targetObs = state$.value.store.observable[operatorEntry!.target_observable_id]
    const pipeOutputObs = state$.value.store.observable[pipeEntry!.observable_id]

    expect({ pipeEntry, operatorEntry, sourceObs, targetObs, pipeOutputObs }).toMatchInlineSnapshot(`
      {
        "operatorEntry": {
          "created_at": 0,
          "created_at_end": 0,
          "id": "18",
          "index": 0,
          "operator_fun_id": "UNKNOWN",
          "pipe_id": "13",
          "source_observable_id": "0",
          "target_observable_id": "20",
        },
        "pipeEntry": {
          "created_at": 0,
          "created_at_end": 0,
          "id": "13",
          "observable_id": "20",
          "parent_observable_id": "0",
        },
        "pipeOutputObs": {
          "created_at": 0,
          "created_at_end": 0,
          "id": "20",
          "name": "of(1,2,3).map(fn)",
          "obs_ref": WeakRef {},
        },
        "sourceObs": {
          "created_at": 0,
          "created_at_end": 0,
          "id": "0",
          "name": "of(1,2,3)",
          "obs_ref": WeakRef {},
        },
        "targetObs": {
          "created_at": 0,
          "created_at_end": 0,
          "id": "20",
          "name": "of(1,2,3).map(fn)",
          "obs_ref": WeakRef {},
        },
      }
    `)
  })

  it("tracks switchMap?", async () => {
    proxy
      .of(5)
      .pipe(proxy.switchMap((val, index) => proxy.of(index + "/" + val)))
      .subscribe()

    expect(renderStaticTree(state$.value.store)).toMatchInlineSnapshot(`
      "of(5)                                                            // #0
        .pipe(                                                         // 
          op(),                                                        // #12
          switchMap(fn)((val, index) => proxy.of(index + "/" + val)),  // #12
        )                                                              // -> #12"
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
            "path": "$args.0.0",
            "value": 5,
          },
          "2": {
            "created_at": 0,
            "id": "2",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0.0",
            "value": 5,
          },
          "22": {
            "created_at": 0,
            "id": "22",
            "is_function": false,
            "observable_id": "21",
            "owner_id": "21",
            "path": "$args.0.0",
            "value": "0/5",
          },
          "23": {
            "created_at": 0,
            "id": "23",
            "is_function": false,
            "observable_id": "21",
            "owner_id": "21",
            "path": "$args.0.0",
            "value": "0/5",
          },
          "24": {
            "created_at": 0,
            "id": "24",
            "is_function": false,
            "observable_id": "21",
            "owner_id": "21",
            "path": "$args.0",
            "value": "0/5",
          },
          "25": {
            "created_at": 0,
            "id": "25",
            "is_function": false,
            "observable_id": "21",
            "owner_id": "21",
            "path": "$args.0",
            "value": "0/5",
          },
          "26": {
            "created_at": 0,
            "id": "26",
            "is_function": false,
            "observable_id": "21",
            "owner_id": "21",
            "path": "$args.0",
          },
          "3": {
            "created_at": 0,
            "id": "3",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0",
            "value": 5,
          },
          "4": {
            "created_at": 0,
            "id": "4",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0",
            "value": 5,
          },
          "7": {
            "created_at": 0,
            "fn_ref": WeakRef {},
            "fn_source": "(val, index) => __vite_ssr_import_5__.proxy.of(index + "/" + val)",
            "id": "7",
            "is_function": true,
            "owner_id": "6",
            "path": "$args.0",
          },
          "9": {
            "created_at": 0,
            "fn_ref": WeakRef {},
            "fn_source": "(...callArgs) => {
            const id = (0,__vite_ssr_import_3__.createId)();
            __vite_ssr_import_2__._observableEvents$.next({
              type: "arg-call",
              id,
              arg_id,
              args: callArgs
            });
            const fn = __vite_ssr_import_2__.state$.value.store.arg[arg_id]?.fn_ref?.deref();
            const out = fn ? fn(...callArgs) : void 0;
            __vite_ssr_import_2__._observableEvents$.next({
              type: "arg-call-return",
              id,
              observable_id: __vite_ssr_import_3__.observableIdMap.get(out) ?? "UNKNOWN"
            });
            return out;
          }",
            "id": "9",
            "is_function": true,
            "owner_id": "8",
            "path": "$args.0",
          },
        },
        "arg_call": {
          "19": {
            "arg_id": "9",
            "created_at": 0,
            "created_at_end": 0,
            "id": "19",
            "input_values": [
              5,
              0,
            ],
            "observable_id": "21",
            "subscription_id": "16",
          },
          "20": {
            "arg_id": "7",
            "created_at": 0,
            "created_at_end": 0,
            "id": "20",
            "input_values": [
              5,
              0,
            ],
            "observable_id": "21",
            "subscription_id": "16",
          },
        },
        "hmr_module": {},
        "hmr_track": {},
        "observable": {
          "0": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "0",
            "name": "of(5)",
            "obs_ref": WeakRef {},
          },
          "12": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "12",
            "name": "of(5).switchMap(fn)",
            "obs_ref": WeakRef {},
          },
          "21": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "21",
            "name": "innerFrom($ref[21])",
            "obs_ref": WeakRef {},
          },
        },
        "operator": {
          "10": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "10",
            "index": 0,
            "operator_fun_id": "UNKNOWN",
            "pipe_id": "5",
            "source_observable_id": "0",
            "target_observable_id": "12",
          },
          "11": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "11",
            "index": 0,
            "operator_fun_id": "6",
            "pipe_id": "5",
            "source_observable_id": "0",
            "target_observable_id": "12",
          },
        },
        "operator_fun": {
          "6": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "6",
            "name": "switchMap(fn)",
          },
          "8": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "8",
            "name": "switchMap(fn)",
          },
        },
        "pipe": {
          "5": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "5",
            "observable_id": "12",
            "parent_observable_id": "0",
          },
        },
        "send": {},
        "subscription": {
          "13": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "13",
            "is_sync": false,
            "module_id": undefined,
            "observable_id": "12",
            "parent_subscription_id": undefined,
          },
          "14": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "14",
            "is_sync": false,
            "module_id": undefined,
            "observable_id": "12",
            "parent_subscription_id": "13",
          },
          "15": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "15",
            "is_sync": false,
            "module_id": undefined,
            "observable_id": "0",
            "parent_subscription_id": "14",
          },
          "16": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "16",
            "is_sync": false,
            "module_id": undefined,
            "observable_id": "0",
            "parent_subscription_id": "15",
          },
          "27": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "27",
            "is_sync": false,
            "module_id": undefined,
            "observable_id": "21",
            "parent_subscription_id": "16",
          },
          "28": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "28",
            "is_sync": false,
            "module_id": undefined,
            "observable_id": "21",
            "parent_subscription_id": "27",
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
      "innerFrom($ref[0])  // #0
        .pipe(            // 
          op(),           // #14
          share()(),      // #14
        )                 // -> #14
      new Subject         // #17
      new Subject         // #43"
    `)
  })

  it("tracks 2 root observables", () => {
    const a$ = proxy.of(1).pipe(proxy.map(x => x * 2))
    const b$ = proxy.of(2).pipe(proxy.filter(x => x > 0))

    expect(renderStaticTree(state$.value.store)).toMatchInlineSnapshot(`
      "of(1)                          // #0
        .pipe(                       // 
          op(),                      // #12
          map(fn)((x) => x * 2),     // #12
        )                            // -> #12
      of(2)                          // #13
        .pipe(                       // 
          op(),                      // #25
          filter(fn)((x) => x > 0),  // #25
        )                            // -> #25"
    `)
  })

  it("tracks observable refs across pipes", () => {
    const a$ = proxy.of(1).pipe(proxy.map(x => x * 2))
    const b$ = proxy.of(2).pipe(proxy.filter(x => x > 0))
    const c$ = a$.pipe(proxy.switchMap(() => b$))

    expect(state$.value.store.pipe).toMatchInlineSnapshot(`
      {
        "18": {
          "created_at": 0,
          "created_at_end": 0,
          "id": "18",
          "observable_id": "25",
          "parent_observable_id": "13",
        },
        "26": {
          "created_at": 0,
          "created_at_end": 0,
          "id": "26",
          "observable_id": "33",
          "parent_observable_id": "12",
        },
        "5": {
          "created_at": 0,
          "created_at_end": 0,
          "id": "5",
          "observable_id": "12",
          "parent_observable_id": "0",
        },
      }
    `)
    expect(renderStaticTree(state$.value.store)).toMatchInlineSnapshot(`
      "of(1)                          // #0
        .pipe(                       // 
          op(),                      // #12
          map(fn)((x) => x * 2),     // #12
        )                            // -> #12
      of(2)                          // #13
        .pipe(                       // 
          op(),                      // #25
          filter(fn)((x) => x > 0),  // #25
        )                            // -> #25
      #12                            // 
        .pipe(                       // 
          op(),                      // #33
          switchMap(fn)(() => b$),   // #33
        )                            // -> #33"
    `)
  })
})

describe("06_queries", () => {
  useTrackingTestSetup(true)

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
          "name": "of(5)",
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
          "id": "5",
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
          "operator_fun_id": "UNKNOWN",
        },
        {
          "index": 0,
          "operator_fun_id": "6",
        },
        {
          "index": 1,
          "operator_fun_id": "UNKNOWN",
        },
        {
          "index": 1,
          "operator_fun_id": "10",
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
          "id": "5",
          "observable_id": "0",
          "parent": undefined,
        },
        {
          "id": "16",
          "observable_id": "11",
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
          "id": "14",
          "parent": "13",
        },
      ]
    `)
  })

  it("getSendsFor returns sends for a subscription", () => {
    proxy.of(1, 2).subscribe()

    const store = state$.value.store
    const topLevel = getTopLevelSubscriptions(store)
    const sends = getSendsFor(store, topLevel[0]!.id)

    expect(sends).toMatchInlineSnapshot(`[]`)
  })

  it("getAllSends returns all sends sorted by time", () => {
    setNow(100)
    proxy.of(1).subscribe()
    setNow(200)
    proxy.of(2).subscribe()

    const sends = getAllSends(state$.value.store)

    expect(sends.map(s => ({ created_at: s.created_at, type: s.type, value: s.value }))).toMatchInlineSnapshot(`[]`)
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
          "id": "21",
          "name": "innerFrom($ref[21])",
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
        "arg_id": "9",
        "id": "19",
        "observable_id": "21",
      }
    `)
  })
})
