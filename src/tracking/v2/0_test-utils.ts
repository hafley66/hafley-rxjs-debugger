/**
 * Common test setup utilities
 */

import { afterEach, beforeEach } from "vitest"
import { isEnabled$, state$ } from "./00.types"
import { resetIdCounter, setNow } from "./01_helpers"

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
    resetIdCounter()
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
