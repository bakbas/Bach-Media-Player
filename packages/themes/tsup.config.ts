import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    minimal: 'src/minimal.ts',
    cinematic: 'src/cinematic.ts',
    broadcast: 'src/broadcast.ts',
    terminal: 'src/terminal.ts',
    vintage: 'src/vintage.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  treeshake: true,
  splitting: false,
  external: ['@bach/core'],
});
