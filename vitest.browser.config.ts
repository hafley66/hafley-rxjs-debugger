import react from "@vitejs/plugin-react"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"
import { rxjsDebuggerPlugin } from "./src/vite-plugin/v2"

export default defineConfig({
  plugins: [
    react(),
    rxjsDebuggerPlugin({ debug: false }),
  ],
  optimizeDeps: {
    exclude: ["rxjs"],
  },
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        {
          browser: "chromium",
          viewport: { width: 1280, height: 800 },
        },
      ],
      headless: true,
      screenshotFailures: true,
    },
    include: ["src/**/*.browser.test.{ts,tsx}"],
  },
})
