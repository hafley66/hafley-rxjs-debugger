import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { page } from "vitest/browser"
import { state$ } from "../00.types"
import { resetIdCounter, setNow, track } from "../01_helpers"

import "../03_scan-accumulator"
import { proxy } from "../04.operators"

import { DebuggerGrid } from "./0_DebuggerGrid"

describe("DebuggerGrid", () => {
  beforeEach(() => {
    resetIdCounter()
    setNow(0)
    state$.reset()
    state$.set({ isEnabled: true })
    track(true)
  })

  afterEach(() => {
    track(false)
    resetIdCounter()
    setNow(null)
    state$.set({ isEnabled: false })
    cleanup()
  })

  it("renders switchMap with dynamic observables", async () => {
    // Create observable chain
    proxy
      .of(5)
      .pipe(proxy.switchMap((val, index) => proxy.of(index + "/" + val)))
      .subscribe()
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
          "17": {
            "created_at": 0,
            "id": "17",
            "is_function": false,
            "observable_id": "16",
            "owner_id": "16",
            "path": "$args.0.0",
            "value": "0/5",
          },
          "18": {
            "created_at": 0,
            "id": "18",
            "is_function": false,
            "observable_id": "16",
            "owner_id": "16",
            "path": "$args.0",
            "value": "0/5",
          },
          "19": {
            "created_at": 0,
            "id": "19",
            "is_function": false,
            "observable_id": "16",
            "owner_id": "16",
            "path": "$args.0",
            "value": "0/5",
          },
          "2": {
            "created_at": 0,
            "id": "2",
            "is_function": false,
            "observable_id": "0",
            "owner_id": "0",
            "path": "$args.0",
            "value": 5,
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
          "6": {
            "created_at": 0,
            "fn_source": "(val, index) => proxy.of(index + "/" + val)",
            "id": "6",
            "is_function": true,
            "owner_id": "5",
            "path": "$args.0",
          },
          "8": {
            "created_at": 0,
            "fn_source": "(...args2) => {
            const id = createId();
            _observableEvents$.next({
              type: "arg-call",
              id,
              arg_id,
              args: args2
            });
            const out = value(...args2);
            _observableEvents$.next({
              type: "arg-call-return",
              id,
              observable_id: observableIdMap.get(out) ?? "UNKNOWN"
            });
            return out;
          }",
            "id": "8",
            "is_function": true,
            "owner_id": "7",
            "path": "$args.0",
          },
        },
        "arg_call": {
          "14": {
            "arg_id": "8",
            "created_at": 0,
            "created_at_end": 0,
            "id": "14",
            "input_values": [
              5,
              0,
            ],
            "observable_id": "16",
            "subscription_id": "11",
          },
          "15": {
            "arg_id": "6",
            "created_at": 0,
            "created_at_end": 0,
            "id": "15",
            "input_values": [
              5,
              0,
            ],
            "observable_id": "16",
            "subscription_id": "11",
          },
        },
        "observable": {
          "0": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "0",
            "name": "of",
          },
          "16": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "16",
            "name": "of",
          },
        },
        "operator": {
          "9": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "9",
            "index": 0,
            "operator_fun_id": "5",
            "pipe_id": "4",
            "source_observable_id": "0",
            "target_observable_id": "10",
          },
        },
        "operator_fun": {
          "5": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "5",
            "name": "switchMap",
          },
          "7": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "7",
            "name": "switchMap",
          },
        },
        "pipe": {
          "4": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "4",
            "observable_id": "10",
            "parent_observable_id": "0",
          },
        },
        "send": {
          "13": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "13",
            "observable_id": "0",
            "subscription_id": "12",
            "type": "next",
            "value": 5,
          },
          "21": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "21",
            "observable_id": "16",
            "subscription_id": "20",
            "type": "next",
            "value": "0/5",
          },
          "22": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "22",
            "observable_id": "10",
            "subscription_id": "11",
            "type": "next",
            "value": "0/5",
          },
          "23": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "23",
            "observable_id": "16",
            "subscription_id": "20",
            "type": "complete",
          },
          "24": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "24",
            "observable_id": "0",
            "subscription_id": "12",
            "type": "complete",
          },
          "25": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "25",
            "observable_id": "10",
            "subscription_id": "11",
            "type": "complete",
          },
        },
        "subscription": {
          "11": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "11",
            "is_sync": false,
            "observable_id": "10",
            "parent_subscription_id": undefined,
          },
          "12": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "12",
            "is_sync": false,
            "observable_id": "0",
            "parent_subscription_id": "11",
          },
          "20": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "20",
            "is_sync": false,
            "observable_id": "16",
            "parent_subscription_id": "11",
          },
        },
      }
    `)
    const { container } = render(<DebuggerGrid />)
    await new Promise(r => setTimeout(r, 100))
    await page.screenshot({
      path: "./__snapshots__/v2-grid-switchmap.png",
    })
    expect(container.textContent).toContain("of")
    expect(container.textContent).toContain("switchMap")
  })

  it("renders multiple roots with subscriptions", async () => {
    const a$ = proxy.of(1).pipe(proxy.map(x => x * 2))
    const b$ = proxy.of(2).pipe(proxy.filter(x => x > 0))
    a$.subscribe()
    b$.subscribe()
    const { container } = render(<DebuggerGrid />)
    await new Promise(r => setTimeout(r, 100))
    await page.screenshot({
      path: "./__snapshots__/v2-grid-multi-root.png",
    })
    expect(container.textContent).toMatchInlineSnapshot(
      `"StructureSub #22of #0●  .pipe(    map() → #10●2  ) → #10of #11  .pipe(    filter() → #21●  ) → #21Sendsnext: 2complete"`,
    )
  })
  it("renders repeat with sends", async () => {
    setNow(1000)
    let index = 0
    proxy
      .from([12, 15])
      .pipe(
        proxy.repeat({
          delay: () => proxy.of(true),
          count: 2,
        }),
        proxy.tap({
          next: () => setNow(++index * 1000),
          complete: () => setNow(++index * 1000),
          error: () => setNow(++index * 1000),
        }),
      )
      .subscribe()

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
            "fn_source": "(...args2) => {
            const id = createId();
            _observableEvents$.next({
              type: "arg-call",
              id,
              arg_id,
              args: args2
            });
            const out = value(...args2);
            _observableEvents$.next({
              type: "arg-call-return",
              id,
              observable_id: observableIdMap.get(out) ?? "UNKNOWN"
            });
            return out;
          }",
            "id": "10",
            "is_function": true,
            "owner_id": "9",
            "path": "$args.0.delay",
          },
          "11": {
            "created_at": 1000,
            "id": "11",
            "is_function": false,
            "owner_id": "9",
            "path": "$args.0.count",
            "value": 2,
          },
          "13": {
            "created_at": 1000,
            "fn_source": "() => setNow(++index * 1e3)",
            "id": "13",
            "is_function": true,
            "owner_id": "12",
            "path": "$args.0.next",
          },
          "14": {
            "created_at": 1000,
            "fn_source": "() => setNow(++index * 1e3)",
            "id": "14",
            "is_function": true,
            "owner_id": "12",
            "path": "$args.0.complete",
          },
          "15": {
            "created_at": 1000,
            "fn_source": "() => setNow(++index * 1e3)",
            "id": "15",
            "is_function": true,
            "owner_id": "12",
            "path": "$args.0.error",
          },
          "17": {
            "created_at": 1000,
            "fn_source": "(...args2) => {
            const id = createId();
            _observableEvents$.next({
              type: "arg-call",
              id,
              arg_id,
              args: args2
            });
            const out = value(...args2);
            _observableEvents$.next({
              type: "arg-call-return",
              id,
              observable_id: observableIdMap.get(out) ?? "UNKNOWN"
            });
            return out;
          }",
            "id": "17",
            "is_function": true,
            "owner_id": "16",
            "path": "$args.0.next",
          },
          "18": {
            "created_at": 1000,
            "fn_source": "(...args2) => {
            const id = createId();
            _observableEvents$.next({
              type: "arg-call",
              id,
              arg_id,
              args: args2
            });
            const out = value(...args2);
            _observableEvents$.next({
              type: "arg-call-return",
              id,
              observable_id: observableIdMap.get(out) ?? "UNKNOWN"
            });
            return out;
          }",
            "id": "18",
            "is_function": true,
            "owner_id": "16",
            "path": "$args.0.complete",
          },
          "19": {
            "created_at": 1000,
            "fn_source": "(...args2) => {
            const id = createId();
            _observableEvents$.next({
              type: "arg-call",
              id,
              arg_id,
              args: args2
            });
            const out = value(...args2);
            _observableEvents$.next({
              type: "arg-call-return",
              id,
              observable_id: observableIdMap.get(out) ?? "UNKNOWN"
            });
            return out;
          }",
            "id": "19",
            "is_function": true,
            "owner_id": "16",
            "path": "$args.0.error",
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
          "41": {
            "created_at": 2000,
            "id": "41",
            "is_function": false,
            "observable_id": "40",
            "owner_id": "40",
            "path": "$args.0.0",
            "value": true,
          },
          "42": {
            "created_at": 2000,
            "id": "42",
            "is_function": false,
            "observable_id": "40",
            "owner_id": "40",
            "path": "$args.0",
            "value": true,
          },
          "43": {
            "created_at": 2000,
            "id": "43",
            "is_function": false,
            "observable_id": "40",
            "owner_id": "40",
            "path": "$args.0",
            "value": true,
          },
          "7": {
            "created_at": 1000,
            "fn_source": "() => proxy.of(true)",
            "id": "7",
            "is_function": true,
            "owner_id": "6",
            "path": "$args.0.delay",
          },
          "8": {
            "created_at": 1000,
            "id": "8",
            "is_function": false,
            "owner_id": "6",
            "path": "$args.0.count",
            "value": 2,
          },
        },
        "arg_call": {
          "38": {
            "arg_id": "10",
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "38",
            "input_values": [
              1,
            ],
            "observable_id": "40",
            "subscription_id": "24",
          },
          "39": {
            "arg_id": "7",
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "39",
            "input_values": [
              1,
            ],
            "observable_id": "40",
            "subscription_id": "24",
          },
        },
        "observable": {
          "0": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "0",
            "name": "from",
          },
          "40": {
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "40",
            "name": "of",
          },
        },
        "operator": {
          "20": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "20",
            "index": 0,
            "operator_fun_id": "6",
            "pipe_id": "5",
            "source_observable_id": "0",
            "target_observable_id": "21",
          },
          "22": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "22",
            "index": 1,
            "operator_fun_id": "12",
            "pipe_id": "5",
            "source_observable_id": "21",
            "target_observable_id": "23",
          },
        },
        "operator_fun": {
          "12": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "12",
            "name": "tap",
          },
          "16": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "16",
            "name": "tap",
          },
          "6": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "6",
            "name": "repeat",
          },
          "9": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "9",
            "name": "repeat",
          },
        },
        "pipe": {
          "5": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "5",
            "observable_id": "23",
            "parent_observable_id": "0",
          },
        },
        "send": {
          "27": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "27",
            "observable_id": "0",
            "subscription_id": "26",
            "type": "next",
            "value": 12,
          },
          "28": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "28",
            "observable_id": "21",
            "subscription_id": "25",
            "type": "next",
            "value": 12,
          },
          "31": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "31",
            "observable_id": "23",
            "subscription_id": "24",
            "type": "next",
            "value": 12,
          },
          "32": {
            "created_at": 1000,
            "created_at_end": 2000,
            "id": "32",
            "observable_id": "0",
            "subscription_id": "26",
            "type": "next",
            "value": 15,
          },
          "33": {
            "created_at": 1000,
            "created_at_end": 2000,
            "id": "33",
            "observable_id": "21",
            "subscription_id": "25",
            "type": "next",
            "value": 15,
          },
          "36": {
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "36",
            "observable_id": "23",
            "subscription_id": "24",
            "type": "next",
            "value": 15,
          },
          "37": {
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "37",
            "observable_id": "0",
            "subscription_id": "26",
            "type": "complete",
          },
          "45": {
            "created_at": 2000,
            "created_at_end": 5000,
            "id": "45",
            "observable_id": "40",
            "subscription_id": "44",
            "type": "next",
            "value": true,
          },
          "47": {
            "created_at": 2000,
            "created_at_end": 3000,
            "id": "47",
            "observable_id": "0",
            "subscription_id": "46",
            "type": "next",
            "value": 12,
          },
          "48": {
            "created_at": 2000,
            "created_at_end": 3000,
            "id": "48",
            "observable_id": "21",
            "subscription_id": "25",
            "type": "next",
            "value": 12,
          },
          "51": {
            "created_at": 3000,
            "created_at_end": 3000,
            "id": "51",
            "observable_id": "23",
            "subscription_id": "24",
            "type": "next",
            "value": 12,
          },
          "52": {
            "created_at": 3000,
            "created_at_end": 4000,
            "id": "52",
            "observable_id": "0",
            "subscription_id": "46",
            "type": "next",
            "value": 15,
          },
          "53": {
            "created_at": 3000,
            "created_at_end": 4000,
            "id": "53",
            "observable_id": "21",
            "subscription_id": "25",
            "type": "next",
            "value": 15,
          },
          "56": {
            "created_at": 4000,
            "created_at_end": 4000,
            "id": "56",
            "observable_id": "23",
            "subscription_id": "24",
            "type": "next",
            "value": 15,
          },
          "57": {
            "created_at": 4000,
            "created_at_end": 5000,
            "id": "57",
            "observable_id": "0",
            "subscription_id": "46",
            "type": "complete",
          },
          "58": {
            "created_at": 4000,
            "created_at_end": 5000,
            "id": "58",
            "observable_id": "21",
            "subscription_id": "25",
            "type": "complete",
          },
          "61": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "61",
            "observable_id": "23",
            "subscription_id": "24",
            "type": "complete",
          },
          "62": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "62",
            "observable_id": "40",
            "subscription_id": "44",
            "type": "complete",
          },
        },
        "subscription": {
          "24": {
            "created_at": 1000,
            "created_at_end": 5000,
            "id": "24",
            "is_sync": false,
            "observable_id": "23",
            "parent_subscription_id": undefined,
          },
          "25": {
            "created_at": 1000,
            "id": "25",
            "is_sync": false,
            "observable_id": "21",
            "parent_subscription_id": "24",
          },
          "26": {
            "created_at": 1000,
            "id": "26",
            "is_sync": false,
            "observable_id": "0",
            "parent_subscription_id": "25",
            "unsubscribed_at": 2000,
            "unsubscribed_at_end": 2000,
          },
          "44": {
            "created_at": 2000,
            "id": "44",
            "is_sync": false,
            "observable_id": "40",
            "parent_subscription_id": "24",
          },
          "46": {
            "created_at": 2000,
            "created_at_end": 5000,
            "id": "46",
            "is_sync": false,
            "observable_id": "0",
            "parent_subscription_id": "44",
          },
        },
      }
    `)
    const { container } = render(<DebuggerGrid />)
    await new Promise(r => setTimeout(r, 100))
    await page.screenshot({
      path: "./__snapshots__/v2-grid-repeat.png",
    })
    expect(container.textContent).toMatchInlineSnapshot(
      `"StructureSub #24from #0  .pipe(    repeat() → #21●    tap() → #23●5  ) → #23Sendsnext: 12next: 15next: 12next: 15complete"`,
    )
  })

  it("clicks sub header to show marble diagram", async () => {
    // Use the repeat test data which has interesting subscription tree
    setNow(1000)
    let index = 0
    proxy
      .from([12, 15])
      .pipe(
        proxy.repeat({
          delay: () => proxy.of(true),
          count: 2,
        }),
        proxy.tap({
          next: () => setNow(++index * 1000),
          complete: () => setNow(++index * 1000),
          error: () => setNow(++index * 1000),
        }),
      )
      .subscribe()

    const { container } = render(<DebuggerGrid />)
    await new Promise(r => setTimeout(r, 100))

    // Click on Sub #15 header to enter marble diagram view
    const subButton = container.querySelector('button[title="Click to view marble diagram"]') as HTMLButtonElement
    expect(subButton).not.toBeNull()
    subButton.click()

    await new Promise(r => setTimeout(r, 100))
    await page.screenshot({
      path: "./__snapshots__/v2-marble-diagram.png",
    })

    // Verify we're in marble diagram view
    expect(container.textContent).toContain("← Back to Overview")
    expect(container.textContent).toMatch(/Sub #\d+ Tree/)
    expect(container.textContent).toMatchInlineSnapshot(
      `"← Back to OverviewSub #24 Tree#24 (tap)●●●●|└─#25 (repeat)●●●●|└─#26 (from)⊗●●|└─#44 (of)$●|└─#46 (from)●●|1600ms2400ms3200ms4000ms4800ms● next| complete✗ error⊗ unsubscribed$ dynamic observable"`,
    )
  })
})
