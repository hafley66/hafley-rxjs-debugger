/**
 * Common test setup utilities
 */

import { Observable } from "rxjs"
import { afterEach, beforeEach } from "vitest"
import { isEnabled$, resetEventBuffer, state$ } from "./00.types"
import { resetIdCounter, setNow } from "./01_helpers"
import { patchObservable } from "./01.patch-observable"

// Patch Observable once at module load (idempotent - safe if already patched)
let _patched = false
function ensurePatched() {
  if (!_patched) {
    patchObservable(Observable)
    _patched = true
  }
}

type TestSetupOptions = {
  fakeTrack?: boolean
  cleanup?: () => void
}

/**
 * Standard test setup. Resets state, enables tracking, sets time to 0.
 */
export function useTrackingTestSetup(opts: TestSetupOptions | boolean = {}) {
  const { fakeTrack = false, cleanup } = typeof opts === "boolean" ? { fakeTrack: opts } : opts

  beforeEach(() => {
    ensurePatched()
    resetIdCounter()
    resetEventBuffer()
    setNow(0)
    state$.reset()
    isEnabled$.next(true)
    if (fakeTrack) {
      state$.value.stack.hmr_track.push({ id: "test", created_at: 0 } as any)
    }
  })

  afterEach(() => {
    if (fakeTrack) {
      state$.value.stack.hmr_track.pop()
    }
    resetIdCounter()
    setNow(null)
    isEnabled$.next(false)
    cleanup?.()
  })
}
