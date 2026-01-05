import { BehaviorSubject } from "rxjs"
import { map } from "rxjs/operators"

// This file will be transformed by our plugin to wrap with __$

// HMR_MARKER: v1
const multiplier = 10

const source$ = new BehaviorSubject(1)

const doubled$ = source$.pipe(map(x => x * multiplier))

// Expose to window for test access
declare global {
  interface Window {
    __test__: {
      source$: typeof source$
      doubled$: typeof doubled$
      values: number[]
      subscription: ReturnType<typeof doubled$.subscribe> | null
      hmrCount: number
    }
  }
}

// Initialize or preserve test state across HMR
if (!window.__test__) {
  window.__test__ = {
    source$,
    doubled$,
    values: [],
    subscription: null,
    hmrCount: 0,
  }
}

window.__test__.hmrCount++

// On first load, set up subscription
// On HMR reload, the subscription should survive via trackedObservable swap
if (!window.__test__.subscription) {
  window.__test__.subscription = window.__test__.doubled$.subscribe(v => {
    window.__test__.values.push(v)
    document.getElementById("output")!.textContent = window.__test__.values.join(", ")
  })
}

// Update references (for HMR, these point to swapped wrappers)
window.__test__.source$ = source$
window.__test__.doubled$ = doubled$

console.log("[main.ts] loaded, hmrCount:", window.__test__.hmrCount)
