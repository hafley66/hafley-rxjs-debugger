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
            "fn_source": "(val, index) => proxy.of(index + "/" + val)",
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
          "16": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "16",
            "observable_id": "11",
            "subscription_id": "13",
            "type": "complete",
          },
          "17": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "17",
            "observable_id": "0",
            "subscription_id": "8",
            "type": "complete",
          },
          "18": {
            "created_at": 0,
            "created_at_end": 0,
            "id": "18",
            "observable_id": "6",
            "subscription_id": "7",
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
      `"StructureSub #14Sub #21of #0●  .pipe(    map() → #6●2  ) → #6of #7●  .pipe(    filter() → #13●2  ) → #13Sendsnext: 2completenext: 2complete"`,
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
            "fn_source": "() => setNow(++index * 1e3)",
            "id": "10",
            "is_function": true,
            "owner_id": "7",
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
          "29": {
            "created_at": 2000,
            "id": "29",
            "is_function": false,
            "observable_id": "28",
            "owner_id": "28",
            "path": "$args.0",
            "value": true,
          },
          "5": {
            "created_at": 1000,
            "fn_source": "() => proxy.of(true)",
            "id": "5",
            "is_function": true,
            "owner_id": "4",
            "path": "$args.0.delay",
          },
          "6": {
            "created_at": 1000,
            "id": "6",
            "is_function": false,
            "owner_id": "4",
            "path": "$args.0.count",
            "value": 2,
          },
          "8": {
            "created_at": 1000,
            "fn_source": "() => setNow(++index * 1e3)",
            "id": "8",
            "is_function": true,
            "owner_id": "7",
            "path": "$args.0.next",
          },
          "9": {
            "created_at": 1000,
            "fn_source": "() => setNow(++index * 1e3)",
            "id": "9",
            "is_function": true,
            "owner_id": "7",
            "path": "$args.0.complete",
          },
        },
        "arg_call": {
          "27": {
            "arg_id": "5",
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "27",
            "input_values": [
              1,
            ],
            "observable_id": "28",
            "subscription_id": "16",
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
          "11": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "11",
            "index": 0,
            "operator_fun_id": "4",
            "pipe_id": "3",
            "source_observable_id": "0",
            "target_observable_id": "12",
          },
          "13": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "13",
            "index": 1,
            "operator_fun_id": "7",
            "pipe_id": "3",
            "source_observable_id": "12",
            "target_observable_id": "14",
          },
        },
        "operator_fun": {
          "4": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "4",
            "name": "repeat",
          },
          "7": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "7",
            "name": "tap",
          },
        },
        "pipe": {
          "3": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "3",
            "observable_id": "14",
            "parent_observable_id": "0",
          },
        },
        "send": {
          "18": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "18",
            "observable_id": "0",
            "subscription_id": "17",
            "type": "next",
            "value": 12,
          },
          "19": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "19",
            "observable_id": "12",
            "subscription_id": "16",
            "type": "next",
            "value": 12,
          },
          "21": {
            "created_at": 1000,
            "created_at_end": 1000,
            "id": "21",
            "observable_id": "14",
            "subscription_id": "15",
            "type": "next",
            "value": 12,
          },
          "22": {
            "created_at": 1000,
            "created_at_end": 2000,
            "id": "22",
            "observable_id": "0",
            "subscription_id": "17",
            "type": "next",
            "value": 15,
          },
          "23": {
            "created_at": 1000,
            "created_at_end": 2000,
            "id": "23",
            "observable_id": "12",
            "subscription_id": "16",
            "type": "next",
            "value": 15,
          },
          "25": {
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "25",
            "observable_id": "14",
            "subscription_id": "15",
            "type": "next",
            "value": 15,
          },
          "26": {
            "created_at": 2000,
            "created_at_end": 2000,
            "id": "26",
            "observable_id": "0",
            "subscription_id": "17",
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
            "observable_id": "12",
            "subscription_id": "16",
            "type": "next",
            "value": 12,
          },
          "36": {
            "created_at": 3000,
            "created_at_end": 3000,
            "id": "36",
            "observable_id": "14",
            "subscription_id": "15",
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
            "observable_id": "12",
            "subscription_id": "16",
            "type": "next",
            "value": 15,
          },
          "40": {
            "created_at": 4000,
            "created_at_end": 4000,
            "id": "40",
            "observable_id": "14",
            "subscription_id": "15",
            "type": "next",
            "value": 15,
          },
          "41": {
            "created_at": 4000,
            "created_at_end": 5000,
            "id": "41",
            "observable_id": "0",
            "subscription_id": "32",
            "type": "complete",
          },
          "42": {
            "created_at": 4000,
            "created_at_end": 5000,
            "id": "42",
            "observable_id": "12",
            "subscription_id": "16",
            "type": "complete",
          },
          "44": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "44",
            "observable_id": "14",
            "subscription_id": "15",
            "type": "complete",
          },
          "45": {
            "created_at": 5000,
            "created_at_end": 5000,
            "id": "45",
            "observable_id": "28",
            "subscription_id": "30",
            "type": "complete",
          },
        },
        "subscription": {
          "15": {
            "created_at": 1000,
            "created_at_end": 5000,
            "id": "15",
            "is_sync": false,
            "observable_id": "14",
            "parent_subscription_id": undefined,
          },
          "16": {
            "created_at": 1000,
            "created_at_end": 5000,
            "id": "16",
            "is_sync": false,
            "observable_id": "12",
            "parent_subscription_id": "15",
          },
          "17": {
            "created_at": 1000,
            "created_at_end": 2000,
            "id": "17",
            "is_sync": false,
            "observable_id": "0",
            "parent_subscription_id": "16",
            "unsubscribed_at": 2000,
            "unsubscribed_at_end": 2000,
          },
          "30": {
            "created_at": 2000,
            "created_at_end": 5000,
            "id": "30",
            "is_sync": false,
            "observable_id": "28",
            "parent_subscription_id": "16",
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
    const { container } = render(<DebuggerGrid />)
    await new Promise(r => setTimeout(r, 100))
    await page.screenshot({
      path: "./__snapshots__/v2-grid-repeat.png",
    })
    expect(container.textContent).toMatchInlineSnapshot(
      `"StructureSub #15from #0  .pipe(    repeat() → #12●    tap() → #14●5  ) → #14Sendsnext: 12next: 15next: 12next: 15complete"`,
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
    expect(container.textContent).toContain("Sub #15 Tree")
    expect(container.textContent).toMatchInlineSnapshot(
      `"← Back to OverviewSub #15 Tree#15 (tap)●●●●|└─#16 (repeat)●●●●|└─#17 (from)⊗●●|└─#30 (of)$●|└─#32 (from)●●|1600ms2400ms3200ms4000ms4800ms● next| complete✗ error⊗ unsubscribed$ dynamic observable"`,
    )
  })
})
