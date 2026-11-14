import { defineConfig } from 'tsup';

// Bundles the server and the internal @gravity/* workspace packages (which
// ship TypeScript source) into dist/. npm dependencies stay external.
export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: [/^@gravity\//],
});
