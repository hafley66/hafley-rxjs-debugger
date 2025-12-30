/**
 * Tests validating share() tracking behavior.
 *
 * Key assumptions:
 * 1. shared$ is new observable with parent = source$
 * 2. Multiple subs to shared$ reference same observable ID
 * 3. share's internal subscription to source$ is captured (no parent)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { share, shareReplay, take } from "../operators"
import { patchPipe, unpatchPipe } from "../pipe-patch"
import { activeSubscriptions, archivedSubscriptions, getMetadata, resetRegistry } from "../registry"
import { interval, ReplaySubject, timer } from "../rxjs-patched"
import { patchSubscribe, unpatchSubscribe } from "../subscribe-patch"

describe("share behavior tracking", () => {
  beforeEach(() => {
    unpatchSubscribe()
    unpatchPipe()
    resetRegistry()
    patchPipe()
    patchSubscribe()
  })

  afterEach(() => {
    unpatchSubscribe()
    unpatchPipe()
  })

  it("tracks share observable relationships and subscriptions", () => {
    const source$ = interval(1000)
    const shared$ = source$.pipe(share())

    const sourceMeta = getMetadata(source$)!
    const sharedMeta = getMetadata(shared$)!

    // -- both have metadata (wrapped creation + pipe)
    expect(sourceMeta).toBeDefined()
    expect(sharedMeta).toBeDefined()
    expect(sharedMeta.id).not.toBe(sourceMeta.id)
    expect(sharedMeta.parent!.deref()).toBe(source$)
    expect(sharedMeta.operators).toContain("share")

    // -- multiple subs reference same observable ID
    const sub1 = shared$.subscribe()
    const sub2 = shared$.subscribe()
    const sub3 = shared$.subscribe()

    const sharedSubs = [...activeSubscriptions.values()].filter(s => s.observableId === sharedMeta.id)
    expect(sharedSubs.length).toBe(3)

    // -- share's internal subscription to source$ IS captured
    // NOTE: it has a parent because it's created during the first subscribe call
    const sourceSubs = [...activeSubscriptions.values()].filter(s => s.observableId === sourceMeta.id)
    expect(sourceSubs.length).toBe(1) // only ONE despite 3 subscribers
    expect(sourceSubs[0].parentSubscriptionId).toBeDefined() // has parent (first user sub)

    sub1.unsubscribe()
    sub2.unsubscribe()
    sub3.unsubscribe()
  })

  it("ref count inferred from active subscriptions", () => {
    const shared$ = interval(1000).pipe(share())
    const obsId = getMetadata(shared$)!.id

    const refCount = () => [...activeSubscriptions.values()].filter(s => s.observableId === obsId).length

    expect(refCount()).toBe(0)

    const sub1 = shared$.subscribe()
    expect(refCount()).toBe(1)

    const sub2 = shared$.subscribe()
    expect(refCount()).toBe(2)

    sub1.unsubscribe()
    expect(refCount()).toBe(1)

    sub2.unsubscribe()
    expect(refCount()).toBe(0)
  })

  it("internal subscription archived when all unsubscribe", () => {
    const source$ = interval(1000)
    const shared$ = source$.pipe(share())
    const sourceId = getMetadata(source$)!.id

    const sub1 = shared$.subscribe()
    const sub2 = shared$.subscribe()

    // internal subscription to source$ exists
    const getSourceSubs = () => [...activeSubscriptions.values()].filter(s => s.observableId === sourceId)
    expect(getSourceSubs().length).toBe(1)

    sub1.unsubscribe()
    // still exists (sub2 still subscribed)
    expect(getSourceSubs().length).toBe(1)

    sub2.unsubscribe()
    // share cleans up internal subscription when all unsubscribe
    expect(getSourceSubs().length).toBe(0)

    // check it moved to archive
    const archivedSourceSubs = [...archivedSubscriptions.values()].filter(s => s.observableId === sourceId)
    expect(archivedSourceSubs.length).toBe(1)
  })
})

describe("shareReplay behavior tracking", () => {
  beforeEach(() => {
    unpatchSubscribe()
    unpatchPipe()
    resetRegistry()
    patchPipe()
    patchSubscribe()
  })

  afterEach(() => {
    unpatchSubscribe()
    unpatchPipe()
  })

  it("tracks shareReplay with buffer size", () => {
    const source$ = interval(1000)
    const shared$ = source$.pipe(shareReplay(1))

    const sourceMeta = getMetadata(source$)!
    const sharedMeta = getMetadata(shared$)!

    expect(sharedMeta).toBeDefined()
    expect(sharedMeta.operators).toContain("shareReplay")
    expect(sharedMeta.parent!.deref()).toBe(source$)

    const sub1 = shared$.subscribe()
    const sub2 = shared$.subscribe()

    // Both subs reference same observable
    const sharedSubs = [...activeSubscriptions.values()].filter(s => s.observableId === sharedMeta.id)
    expect(sharedSubs.length).toBe(2)

    // Internal ReplaySubject subscription exists
    const sourceSubs = [...activeSubscriptions.values()].filter(s => s.observableId === sourceMeta.id)
    expect(sourceSubs.length).toBe(1)

    sub1.unsubscribe()
    sub2.unsubscribe()
  })

  it("tracks shareReplay with refCount behavior", () => {
    const source$ = interval(1000)
    const shared$ = source$.pipe(shareReplay({ bufferSize: 1, refCount: true }))

    const sourceMeta = getMetadata(source$)!
    const sharedMeta = getMetadata(shared$)!

    const sub1 = shared$.subscribe()
    expect([...activeSubscriptions.values()].filter(s => s.observableId === sourceMeta.id).length).toBe(1)

    sub1.unsubscribe()
    // With refCount: true, internal subscription should be cleaned up
    expect([...activeSubscriptions.values()].filter(s => s.observableId === sourceMeta.id).length).toBe(0)
  })
})

describe("share with react-query style caching", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    unpatchSubscribe()
    unpatchPipe()
    resetRegistry()
    patchPipe()
    patchSubscribe()
  })

  afterEach(() => {
    unpatchSubscribe()
    unpatchPipe()
    vi.useRealTimers()
  })

  it("tracks share with ReplaySubject connector and delayed reset", () => {
    // React-query style: replay last value, unsubscribe from source when no subscribers,
    // but delay reset so late subscribers can reuse cached value
    const source$ = interval(100)
    const cached$ = source$.pipe(
      share({
        connector: () => new ReplaySubject(1),
        resetOnRefCountZero: () => timer(1000), // wait 1s before resetting
      }),
    )

    const cachedMeta = getMetadata(cached$)!
    expect(cachedMeta.operators).toContain("share")

    // Subscribe and get some values
    const values: number[] = []
    const sub1 = cached$.subscribe(v => values.push(v))

    vi.advanceTimersByTime(250) // 0, 1 emitted
    expect(values).toEqual([0, 1])

    // Second subscriber gets replay of last value (1) plus new values
    const values2: number[] = []
    const sub2 = cached$.subscribe(v => values2.push(v))
    expect(values2).toEqual([1]) // replayed immediately

    vi.advanceTimersByTime(100) // 2 emitted
    expect(values).toEqual([0, 1, 2])
    expect(values2).toEqual([1, 2])

    sub1.unsubscribe()
    sub2.unsubscribe()

    // Snapshot the subscription structure
    const subsSnapshot = [...activeSubscriptions.values(), ...archivedSubscriptions.values()]
      .map(s => ({
        id: s.id,
        observableId: s.observableId,
        parentSubscriptionId: s.parentSubscriptionId ?? null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id))

    expect(subsSnapshot).toMatchInlineSnapshot(`
      [
        {
          "id": "sub#0",
          "observableId": "obs#1",
          "parentSubscriptionId": null,
        },
        {
          "id": "sub#1",
          "observableId": "obs#2",
          "parentSubscriptionId": "sub#0",
        },
        {
          "id": "sub#2",
          "observableId": "obs#0",
          "parentSubscriptionId": "sub#0",
        },
        {
          "id": "sub#3",
          "observableId": "obs#1",
          "parentSubscriptionId": null,
        },
        {
          "id": "sub#4",
          "observableId": "obs#2",
          "parentSubscriptionId": "sub#3",
        },
        {
          "id": "sub#5",
          "observableId": "obs#3",
          "parentSubscriptionId": null,
        },
      ]
    `)
  })

  it("tracks internal ReplaySubject created by connector", () => {
    let connectorCalled = 0
    const source$ = interval(100)
    const cached$ = source$.pipe(
      share({
        connector: () => {
          connectorCalled++
          return new ReplaySubject(1)
        },
        resetOnRefCountZero: () => timer(500),
      }),
    )

    const sub1 = cached$.subscribe()
    expect(connectorCalled).toBe(1)

    const sub2 = cached$.subscribe()
    expect(connectorCalled).toBe(1) // same connector instance

    sub1.unsubscribe()
    sub2.unsubscribe()

    // Within reset window, reuses same subject
    const sub3 = cached$.subscribe()
    expect(connectorCalled).toBe(1)

    sub3.unsubscribe()

    // Advance past reset timer
    vi.advanceTimersByTime(600)

    // After reset, new subscription creates new subject
    const sub4 = cached$.subscribe()
    expect(connectorCalled).toBe(2)

    sub4.unsubscribe()
    vi.advanceTimersByTime(600)

    // Snapshot all subscriptions showing the connector resets
    const subsSnapshot = [...activeSubscriptions.values(), ...archivedSubscriptions.values()]
      .map(s => ({
        id: s.id,
        observableId: s.observableId,
        parentSubscriptionId: s.parentSubscriptionId ?? null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id))

    expect(subsSnapshot).toMatchInlineSnapshot(`
      [
        {
          "id": "sub#0",
          "observableId": "obs#1",
          "parentSubscriptionId": null,
        },
        {
          "id": "sub#1",
          "observableId": "obs#2",
          "parentSubscriptionId": "sub#0",
        },
        {
          "id": "sub#10",
          "observableId": "obs#5",
          "parentSubscriptionId": "sub#9",
        },
        {
          "id": "sub#11",
          "observableId": "obs#0",
          "parentSubscriptionId": "sub#9",
        },
        {
          "id": "sub#12",
          "observableId": "obs#6",
          "parentSubscriptionId": null,
        },
        {
          "id": "sub#2",
          "observableId": "obs#0",
          "parentSubscriptionId": "sub#0",
        },
        {
          "id": "sub#3",
          "observableId": "obs#1",
          "parentSubscriptionId": null,
        },
        {
          "id": "sub#4",
          "observableId": "obs#2",
          "parentSubscriptionId": "sub#3",
        },
        {
          "id": "sub#5",
          "observableId": "obs#3",
          "parentSubscriptionId": null,
        },
        {
          "id": "sub#6",
          "observableId": "obs#1",
          "parentSubscriptionId": null,
        },
        {
          "id": "sub#7",
          "observableId": "obs#2",
          "parentSubscriptionId": "sub#6",
        },
        {
          "id": "sub#8",
          "observableId": "obs#4",
          "parentSubscriptionId": null,
        },
        {
          "id": "sub#9",
          "observableId": "obs#1",
          "parentSubscriptionId": null,
        },
      ]
    `)
  })
})
