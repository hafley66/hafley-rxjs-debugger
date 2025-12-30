import { defineConfig } from 'rolldown-vite';
import { rxjsDebuggerPlugin } from "./src/vite-plugin/v2"

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.ts',
      name: 'ObservableTracker',
      fileName: (format) => `index.${format === 'es' ? 'js' : format}`,
      formats: ['es'],
    },
    rollupOptions: {
      external: [],
    },
    sourcemap: true,
    target: 'esnext',
  },
  plugins: [
        rxjsDebuggerPlugin({ debug: true }), // debug: true for verbose logs
  ],
  optimizeDeps: {
    include: ['rxjs', 'rxjs/operators'],
  }
});
