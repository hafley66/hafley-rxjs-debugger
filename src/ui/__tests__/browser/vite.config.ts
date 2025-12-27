import { defineConfig } from 'rolldown-vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const srcDir = path.resolve(__dirname, '../../..');

export default defineConfig({
  plugins: [
    // Custom plugin to redirect rxjs imports (except from tracking folder)
    {
      name: 'rxjs-redirect',
      enforce: 'pre',
      resolveId(source, importer) {
        // Don't redirect imports from within tracking folder (avoids cycle)
        if (importer?.includes('/tracking/')) {
          return null;
        }
        if (source === 'rxjs') {
          const resolved = path.resolve(srcDir, 'tracking/rxjs-patched.ts');
          console.log('[rxjs-redirect] rxjs ->', resolved);
          return { id: resolved };
        }
        if (source === 'rxjs/operators') {
          const resolved = path.resolve(srcDir, 'tracking/operators.ts');
          console.log('[rxjs-redirect] rxjs/operators ->', resolved);
          return { id: resolved };
        }
        return null;
      },
    },
    react(),
  ],
  root: __dirname,
  resolve: {
    alias: {
      // Project aliases
      '@': srcDir,
      '@ui': path.resolve(srcDir, 'ui'),
      '@tracking': path.resolve(srcDir, 'tracking'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
