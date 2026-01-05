import fs from "fs"
import path from "path"
import { chromium, type Browser, type Page } from "playwright"
import { createServer, type ViteDevServer } from "rolldown-vite"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const FIXTURE_DIR = path.join(__dirname, "fixture")
const MAIN_TS_PATH = path.join(FIXTURE_DIR, "main.ts")

// Read original content for restoration
const ORIGINAL_CONTENT = fs.readFileSync(MAIN_TS_PATH, "utf-8")

describe("HMR Integration", () => {
  let server: ViteDevServer
  let browser: Browser
  let page: Page
  let serverUrl: string

  beforeAll(async () => {
    // Restore original content
    fs.writeFileSync(MAIN_TS_PATH, ORIGINAL_CONTENT)

    // Start Vite dev server
    server = await createServer({
      configFile: path.join(FIXTURE_DIR, "vite.config.ts"),
      server: {
        port: 0, // Random available port
      },
    })
    await server.listen()
    const address = server.httpServer?.address()
    if (!address || typeof address === "string") {
      throw new Error("Failed to get server address")
    }
    serverUrl = `http://localhost:${address.port}`

    // Launch browser
    browser = await chromium.launch({ headless: true })
    page = await browser.newPage()

    // Enable console logging for debugging
    page.on("console", msg => {
      console.log(`[browser] ${msg.type()}: ${msg.text()}`)
    })

    // Capture page errors
    page.on("pageerror", err => {
      console.error(`[browser error] ${err.message}`)
    })
  }, 30000)

  afterAll(async () => {
    // Restore original content
    fs.writeFileSync(MAIN_TS_PATH, ORIGINAL_CONTENT)

    await page?.close()
    await browser?.close()
    await server?.close()
  })

  it("loads page with tracked BehaviorSubject", async () => {
    // Collect page errors
    const pageErrors: string[] = []
    page.on("pageerror", err => pageErrors.push(err.message))

    await page.goto(serverUrl)

    // Wait a bit for page to load
    await new Promise(r => setTimeout(r, 3000))

    // Check for errors
    if (pageErrors.length > 0) {
      console.log("Page errors:", pageErrors)
    }

    // Debug: capture page state
    const debugState = await page.evaluate(() => ({
      hasTest: !!window.__test__,
      values: window.__test__?.values ?? [],
      hmrCount: window.__test__?.hmrCount ?? 0,
      hasSource: !!window.__test__?.source$,
      hasSubscription: !!window.__test__?.subscription,
      subscriptionClosed: window.__test__?.subscription?.closed,
      outputText: document.getElementById("output")?.textContent ?? "N/A",
    }))
    console.log("Debug state:", JSON.stringify(debugState, null, 2))

    // Now try the actual test
    expect(pageErrors).toHaveLength(0)
    expect(debugState.hasTest).toBe(true)
    expect(debugState.values.length).toBeGreaterThan(0)

    // BehaviorSubject emits initial value 10
    expect(debugState.values).toEqual([10])
    expect(debugState.hmrCount).toBe(1)
  })

  it("pushes new value through BehaviorSubject", async () => {
    await page.evaluate(() => {
      window.__test__.source$.next(20)
    })

    const testState = await page.evaluate(() => ({
      values: window.__test__.values,
    }))

    expect(testState.values).toEqual([10, 20])
  })

  it("HMR swap: updates initial value and new emissions work", async () => {
    // Modify the source file - change initialValue from 10 to 100
    const modifiedContent = ORIGINAL_CONTENT.replace(
      "// HMR_MARKER: v1\nconst initialValue = 10",
      "// HMR_MARKER: v2\nconst initialValue = 100",
    )
    fs.writeFileSync(MAIN_TS_PATH, modifiedContent)

    // Wait for HMR to process
    await page.waitForFunction(
      () => window.__test__?.hmrCount >= 2,
      { timeout: 10000 },
    )

    const hmrCountAfter = await page.evaluate(() => window.__test__.hmrCount)
    expect(hmrCountAfter).toBeGreaterThanOrEqual(2)

    // Give state$$ time to process HMR events
    await new Promise(r => setTimeout(r, 100))

    // Push a new value through the stable wrapper
    await page.evaluate(() => {
      window.__test__.source$.next(30)
    })

    const finalState = await page.evaluate(() => ({
      values: window.__test__.values,
      hmrCount: window.__test__.hmrCount,
    }))

    // Should have: 10 (initial), 20 (before HMR), 30 (after HMR)
    expect(finalState.values).toContain(10)
    expect(finalState.values).toContain(20)
    expect(finalState.values).toContain(30)
  })

  it("subscription survives HMR - same subscription object", async () => {
    // The subscription should be the same object (not recreated)
    const subscriptionClosed = await page.evaluate(() =>
      window.__test__.subscription?.closed,
    )
    expect(subscriptionClosed).toBe(false)
  })
})
