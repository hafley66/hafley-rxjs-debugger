import { defineConfig } from 'rolldown-vite';

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
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/__tests__/**',
      ],
    },
  },
});
