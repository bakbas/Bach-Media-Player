import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    define: 'src/define.ts',
    whisper: 'src/whisper-engine.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  treeshake: true,
  splitting: false,
  external: ['@bach/core', '@preact/signals-core', '@huggingface/transformers'],
});
