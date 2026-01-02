import { Subject } from "rxjs"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { _observableEvents$, isEnabled$, state$ } from "../00.types"
import { resetIdCounter, setNow } from "../01_helpers"
import "../03_scan-accumulator"
import { proxy } from "../04.operators"
import { __$ } from "./0_runtime"
import { trackedObservable } from "./2_tracked-observable"

describe("trackedObservable", () => {
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

  it("subscribes to tracked observable and receives emissions", () => {
    const source$ = __$("app:source$", () => new Subject<number>())

    const tracked$ = trackedObservable<number>("app:source$")
    const values: number[] = []
    const sub = tracked$.subscribe(v => {
      values.push(v)
    })

    source$.next(1)
    source$.next(2)
    source$.next(3)

    expect(values).toEqual([1, 2, 3])
    sub.unsubscribe()
  })

  it("switches source when track-update changes entity_id", () => {
    const source1$ = __$("app:counter$", () => new Subject<number>())

    const tracked$ = trackedObservable<number>("app:counter$")
    const values: number[] = []
    const sub = tracked$.subscribe(v => values.push(v))

    source1$.next(1)
    expect(values).toEqual([1])

    // Create second source via __$ so it gets registered
    const source2$ = __$("app:counter$:v2", () => new Subject<number>())
    const source2Id = state$.value.store.hmr_track["app:counter$:v2"]?.entity_id

    // Simulate HMR swap
    _observableEvents$.next({
      type: "track-update",
      id: "app:counter$",
      entity_id: source2Id!,
    })

    // Old source ignored
    source1$.next(999)
    expect(values).toEqual([1])

    // New source works
    source2$.next(2)
    source2$.next(3)
    expect(values).toEqual([1, 2, 3])

    sub.unsubscribe()
  })

  it("subscription survives HMR swap", () => {
    const source1$ = __$("app:data$", () => new Subject<number>())

    const tracked$ = trackedObservable<number>("app:data$")
    let completed = false
    const sub = tracked$.subscribe({
      next: () => {},
      complete: () => {
        completed = true
      },
    })

    // Swap - use __$ so source2$ is registered
    const source2$ = __$("app:data$:v2", () => new Subject<number>())
    _observableEvents$.next({
      type: "track-update",
      id: "app:data$",
      entity_id: state$.value.store.hmr_track["app:data$:v2"]?.entity_id!,
    })

    expect(completed).toBe(false)
    expect(sub.closed).toBe(false)

    sub.unsubscribe()
  })

  it("cleans up inner subscription on unsubscribe", () => {
    const source$ = __$("app:stream$", () => new Subject<number>())

    const tracked$ = trackedObservable<number>("app:stream$")
    const values: number[] = []
    const sub = tracked$.subscribe(v => values.push(v))

    source$.next(1)
    sub.unsubscribe()
    source$.next(2)

    expect(values).toEqual([1])
  })

  it("works with hot source and pipe", () => {
    const input$ = new Subject<number>()
    __$("app:piped$", () => input$.pipe(proxy.map(x => x * 10)))

    const tracked$ = trackedObservable<number>("app:piped$")
    const values: number[] = []
    tracked$.subscribe(v => values.push(v))

    input$.next(1)
    input$.next(2)
    input$.next(3)

    expect(values).toEqual([10, 20, 30])
  })
})
