import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.browser.test.ts', 'node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.browser.test.ts',
        'src/**/index.ts',
        'src/**/define.ts',
      ],
      // Branch threshold sits at 75 here (rest of the workspace is 80)
      // because most of the WebGPU code is env-guarded with `??` fallbacks
      // that only trip when a real GPUDevice is around. The browser-mode
      // suite (`*.browser.test.ts`) covers those at run time.
      thresholds: { statements: 85, branches: 75, functions: 85, lines: 85 },
    },
  },
});
