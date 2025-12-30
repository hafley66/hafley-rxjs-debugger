import react from "@vitejs/plugin-react"
import { playwright } from "@vitest/browser-playwright"
import path from "path"
import { defineConfig } from "vitest/config"

const srcDir = path.resolve(__dirname, "../../..")

export default defineConfig({
  plugins: [
    // Custom plugin to redirect rxjs imports (except from tracking folder)
    {
      name: "rxjs-redirect",
      enforce: "pre",
      resolveId(source, importer) {
        // Don't redirect imports from within tracking folder (avoids cycle)
        if (importer?.includes("/tracking/")) {
          return null
        }
        if (source === "rxjs") {
          return { id: path.resolve(srcDir, "tracking/rxjs-patched.ts") }
        }
        if (source === "rxjs/operators") {
          return { id: path.resolve(srcDir, "tracking/operators.ts") }
        }
        return null
      },
    },
    react(),
  ],
  resolve: {
    alias: {
      "@": srcDir,
      "@ui": path.resolve(srcDir, "ui"),
      "@tracking": path.resolve(srcDir, "tracking"),
    },
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
    include: ["**/*.browser.test.{ts,tsx}"],
  },
})
