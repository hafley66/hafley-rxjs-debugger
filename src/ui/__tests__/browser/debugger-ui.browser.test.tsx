/**
 * Browser test for RxJS Debugger UI
 *
 * Uses Playwright to render the test app and capture screenshots.
 */

import { cleanup, render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { page } from "vitest/browser"
import { TestApp } from "./TestApp"

describe("RxJS Debugger UI", () => {
  it("renders the debugger visualization", async () => {
    // Render the test app
    const { container } = render(<TestApp />)

    // Wait for initial render
    await new Promise(r => setTimeout(r, 300))

    // Take screenshot of initial state
    await page.screenshot({
      path: "./__snapshots__/debugger-initial.png",
    })

    // Wait for graph to populate
    await new Promise(r => setTimeout(r, 1200))

    // Debug: log DOM content
    const pipeTreeText = container.textContent
    console.log("[browser-test] DOM text:", pipeTreeText)

    // Take screenshot after data flows
    await page.screenshot({
      path: "./__snapshots__/debugger-with-data.png",
    })

    // Verify the app rendered
    expect(container.querySelector("h1")?.textContent).toBe("RxJS Debugger Test App")

    // Verify we see proper labels from track$() annotations
    expect(pipeTreeText).toContain("session$")
    expect(pipeTreeText).toContain("userProfile$")
    expect(pipeTreeText).toContain("userPosts$")
    expect(pipeTreeText).toContain("notifications$")

    cleanup()
  }, 30000)
})
