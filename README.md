# Bach Media Player

> Composable, themable, AI-native web media player. Five signature differentiators built on top of a clean Web Components core.

**Status:** Sprint 0 — monorepo bootstrap. Not yet published to npm.

Bach Media Player is a vanilla TypeScript / Web Components media player engineered around five capabilities that no single open-source player currently offers together:

| Signature | Package | What it does |
|---|---|---|
| **Notasyon** | `@bach/captions-ai` | Browser-side AI captions via Transformers.js + Whisper (WASM/WebGPU). Zero server. |
| **Hassasiyet** | `@bach/seek-frame` | Frame-accurate seek and step using WebCodecs + MP4Box.js indexing. |
| **Polifoni** | `@bach/audio-mix` | Multi-track audio mixing, equal-power crossfade, spectral analyzer. |
| **Akustik** | `@bach/gpu-fx` | WebGPU shader pipeline: color grade, blur PII, watermark, 3D LUT, film grain. |
| **Conducting** | `@bach/conduct` | World-first live director mode — a livestreamer can change every viewer's player UI in real time via signed, sandboxed theme manifests. |

Beneath the five differentiators sits a deliberate **theming baseline** designed for AI vibe coders: documented CSS custom properties, stable `::part()` names, slot composition, a `headless` mode, and runtime `applyTheme(themeJson)` — all callable in the first prompt.

## Quick links

- [`FEATURES.md`](./FEATURES.md) — full feature checklist (signatures + baseline + theming).
- [`ROADMAP.md`](./ROADMAP.md) — phases 1–6 and what's deferred.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — engine adapter pattern, signals state, plugin lifecycle, conduct protocol.
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — local development, testing, changesets.
- [`SECURITY.md`](./SECURITY.md) — DRM key discipline, conduct sandbox model, vulnerability reporting.

## Local development

Requires Node ≥ 20.11 and `pnpm` ≥ 9.

```bash
pnpm install
pnpm dev          # starts playground + watches packages
pnpm test         # unit tests (Vitest)
pnpm test:browser # component tests in real browsers
pnpm test:e2e     # Playwright E2E across Chromium/Firefox/WebKit
pnpm size         # bundle size budget check
```

## Repository layout

```
packages/
  core/        @bach/core           — <bach-player> element, state, codec negotiator, EME
  engine-hls/  @bach/engine-hls     — hls.js adapter
  engine-dash/ @bach/engine-dash    — Shaka Player adapter
  captions-ai/ @bach/captions-ai    — Whisper worker + caption renderer
  seek-frame/  @bach/seek-frame     — WebCodecs frame stepper
  audio-mix/   @bach/audio-mix      — Web Audio multi-track graph
  gpu-fx/      @bach/gpu-fx         — WebGPU shader pipeline
  ui/          @bach/ui             — controls (play, seek, volume, captions...)
  a11y/        @bach/a11y           — keyboard, ARIA, focus trap
  themes/      @bach/themes         — preset themes + theme.json runtime  (Phase 5)
  tailwind/    @bach/tailwind       — Tailwind preset plugin              (Phase 5)
  conduct/     @bach/conduct        — live director mode protocol         (Phase 5)
  analytics/   @bach/analytics      — IndexedDB QoE                       (Phase 6)
  react/       @bach/react          — React wrapper                       (Phase 6)
  testing/     internal             — MSE/EME/WebCodecs/conduct mocks
apps/
  playground/  Vite SPA — interactive demos + live theme editor
  docs/        Astro + Starlight — documentation site
e2e/           Playwright suite (Chromium/Firefox/WebKit + Mobile Safari)
examples/      vanilla-html, react-vite, vue-vite, nextjs
```

## License

MIT — see [`LICENSE`](./LICENSE).
