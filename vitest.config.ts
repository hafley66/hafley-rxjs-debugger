import { defineConfig } from 'vitest/config';
import { rxjsDebuggerPlugin } from "./src/vite-plugin/v2"

export default defineConfig({
  plugins: [
    rxjsDebuggerPlugin({ debug: true }),
  ],
  optimizeDeps: {
    exclude: ["rxjs"],
  },
  test: {
    globals: true,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.browser.test.{ts,tsx}',
    ],
  },
});
