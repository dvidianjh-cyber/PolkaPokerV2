// Last Modified: 2026-10-10 (v2.0.0.0)
import { defineConfig } from 'vite';

/**
 * Vite configuration. A relative base lets the built site run from any
 * GitHub Pages sub-path without further configuration.
 */
export default defineConfig({
  base: './',
  build: { outDir: 'dist', sourcemap: false },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
