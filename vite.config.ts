import react from "@vitejs/plugin-react"
import { defineConfig } from "rolldown-vite"
import { rxjsDebuggerPlugin } from "./src/vite-plugin/v2"

export default defineConfig({
  build: {
    lib: {
      entry: "./src/index.ts",
      name: "ObservableTracker",
      fileName: format => `index.${format === "es" ? "js" : format}`,
      formats: ["es"],
    },
    rollupOptions: {
      external: [],
    },
    sourcemap: true,
    target: "esnext",
  },
  plugins: [react(), rxjsDebuggerPlugin({ debug: true })],
  optimizeDeps: {
    exclude: ["rxjs"],
  },
})
