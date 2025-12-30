import { defineConfig, type Plugin } from 'rolldown-vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { rxjsTrackPlugin } from '../../../vite-plugin';

const srcDir = path.resolve(__dirname, '../../..');

/**
 * Opt-in RxJS tracking plugin.
 * Only files containing `autotrackRxjs()` get rxjs redirected to tracked versions.
 */
function rxjsOptInPlugin(): Plugin {
  // Cache which files have opted in (checked during transform)
  const optedInFiles = new Set<string>();

  return {
    name: 'rxjs-opt-in',
    enforce: 'pre',

    // Check file content and rewrite imports if opted in
    transform(code, id) {
      // Skip node_modules and non-JS/TS files
      if (id.includes('node_modules') || !/\.[jt]sx?$/.test(id)) {
        return null;
      }

      // Check if file contains autotrackRxjs marker
      if (!code.includes('autotrackRxjs')) {
        return null;
      }

      // This file has opted in
      optedInFiles.add(id);
      console.log('[rxjs-opt-in] Enabling tracking for:', path.relative(srcDir, id));

      // Rewrite rxjs imports to use tracked versions
      let transformed = code;

      // import { ... } from 'rxjs' -> import { ... } from '@tracking/rxjs-patched'
      transformed = transformed.replace(
        /from\s+['"]rxjs['"]/g,
        `from '@tracking/rxjs-patched'`
      );

      // import { ... } from 'rxjs/operators' -> import { ... } from '@tracking/operators'
      transformed = transformed.replace(
        /from\s+['"]rxjs\/operators['"]/g,
        `from '@tracking/operators'`
      );

      return {
        code: transformed,
        map: null,
      };
    },
  };
}

export default defineConfig({
  plugins: [
    // Opt-in rxjs tracking - only transforms files with autotrackRxjs()
    rxjsOptInPlugin(),

    // Auto-annotate RxJS observables with variable names
    // Only applies to files that opt-in via autotrackRxjs()
    rxjsTrackPlugin({
      trackImport: '@tracking/track',
      exclude: /node_modules|\/tracking\//,
    }),

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
