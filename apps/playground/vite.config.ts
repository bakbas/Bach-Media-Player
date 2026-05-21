import { defineConfig } from 'vite';

// `VITE_BASE` is set by the GitHub Pages workflow to `/Bach-Media-Player/`
// so asset URLs resolve under the project subpath. Locally and in `pnpm
// preview` it falls back to `/` so the dev server keeps working unchanged.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  server: { port: 5173, host: '127.0.0.1' },
  preview: { port: 4173, host: '127.0.0.1' },
  build: { target: 'es2022' },
});
