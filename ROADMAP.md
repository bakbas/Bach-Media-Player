# Roadmap

Estimated total to `1.0.0`: ~10 months across six phases. Each phase ends with an alpha/beta npm publish and a regression-free hand-off into the next phase.

## Phase 1 — MVP Core + Theming Baseline (~2.5 months)

| Sprint | Output |
|---|---|
| 0 | Monorepo bootstrap: pnpm + Turborepo, Biome, tsup, Vitest, Playwright, lefthook, changesets, GitHub Actions, mock infrastructure scaffold. |
| 1–2 | `@bach/core` — `<bach-player>` element, signals state, codec negotiator, EME orchestrator. CSS variable token contract + Shadow DOM `::part()` map locked. |
| 3 | `@bach/engine-hls` (hls.js adapter), `@bach/engine-dash` (Shaka adapter), iOS native HLS fallback. |
| 4–5 | `@bach/ui` controls with stable part names + documented CSS vars; `@bach/a11y` keyboard, ARIA, focus trap. |
| 6 | `headless` mode (`<bach-player headless>`), `applyTheme(themeJson)` runtime, `theme.json` v0 schema. |
| 7 | Test infrastructure: 85 % unit coverage gate, E2E (Chromium/Firefox/WebKit) including theming flows (part override, headless render, theme apply). |
| 8 | `apps/playground` with theme switcher demo; `0.1.0-alpha.0` published to npm. |

## Phase 2 — Notasyon / AI Captions (~1.5 months)

| Sprint | Output |
|---|---|
| 9–10 | Transformers.js + Whisper worker, AudioWorklet chunker (30 s window, 16 kHz mono). |
| 11 | Caption renderer (overlay + `<track>` injection), timing aligner (1–2 s resync). |
| 12 | Opt-in model download UX (39 MB disclosure dialog), Cache API persistence. |
| 13–14 | E2E (synthetic audio + transcript accuracy), privacy assertion (network monitor confirms zero leaks). `0.2.0-alpha`. |

## Phase 3 — Hassasiyet / Frame-accurate Seek (~1.5 months)

| Sprint | Output |
|---|---|
| 15–16 | MP4Box.js keyframe indexer + WebCodecs `VideoDecoder` wrapper. |
| 17–18 | `frame-stepper`, `scrub-engine` with high-density pointer preview, LRU frame cache. |
| 19 | `currentTime`-based fallback for non-WebCodecs browsers. |
| 20 | Pixel-perfect E2E snapshot tests, `apps/docs` (Astro + Starlight) skeleton, `0.3.0-alpha`. |

## Phase 4 — Polifoni + Akustik (~2 months)

| Sprint | Output |
|---|---|
| 21–23 | **Polifoni:** `AudioContext` graph, equal-power crossfader, master/slave sync (< 50 ms drift), spectral analyzer overlay. |
| 24–26 | **Akustik:** WebGPU context + `importExternalTexture`, WGSL shaders (color grade, blur region, watermark, 3D LUT, film grain), preset chain, WebGL2 fallback. |
| 27 | Plugin SDK example, perf benchmark (1080p60 + 3-pass < 16 ms/frame), `0.4.0-beta`. |

## Phase 5 — Conducting + Theme Universe (~2 months) — the AI vibe coder gift

**Conducting (world-first live director mode):**

| Sprint | Output |
|---|---|
| 28 | `bach.conduct.v1` WebSocket/SSE protocol, wire format, reconnect, lag detection. |
| 29 | Theme manifest schema v1 (full), Ed25519 manifest signing, viewer-side verify. |
| 30 | Sandbox apply path: whitelisted CSS vars + layout enum only; XSS surface = 0. |
| 31 | `apps/director` SPA (theme editor + live preview + push + AI assist) + VOD timeline embed for replay. |

**Theme Universe (theming enrichment):**

| Sprint | Output |
|---|---|
| 32 | `@bach/themes` — 5 curated presets (Minimal, Cinematic, Broadcast, Terminal, Vintage). |
| 33 | `@bach/tailwind` — Tailwind preset plugin; playground Tailwind example. |
| 34 | Playground live theme editor + AI assist (natural language → theme JSON via Claude API). |
| 35 | `llms.txt` + machine-readable theming reference. `0.5.0-beta`. |

## Phase 6 — 1.0 stable + extras (~1.5 months)

| Sprint | Output |
|---|---|
| 36–37 | `@bach/react` wrapper (Next.js App Router compatible). |
| 38 | `@bach/analytics` (IndexedDB QoE, opt-in upload, open schema). |
| 39 | Scene-aware seek preview (histogram heuristic; ML model deferred to 1.1). |
| 40–41 | Hardening: axe-core a11y audit, CodeQL, bundle audit, conduct fuzz testing. Documentation site complete. `1.0.0`. |

---

## Deferred to post-1.0

These were considered for MVP but pushed out to keep scope honest:

- **Hybrid latency switching** (WebRTC ↔ LL-HLS) — the most ambitious item; needs its own design phase.
- **Vendor-locksuz ad SDKs** — VAST / VPAID / SIMID. Real-world ad servers are messy enough to deserve standalone iteration.
- **Scene detection ML** — beyond the histogram heuristic in Phase 6, an on-device classifier (1.1).
- **Vue / Svelte wrappers** — community-driven once React wrapper proves the pattern.
- **Smart TV / Tizen / webOS runtime** — separate manifest and key system surface, big lift.
- **P2P Media Loader** (WebRTC peer mesh) — operator-mode requires CDN integration partners.
- **Server-side rendering of `<bach-player>`** — declarative shadow DOM lands more broadly in 2026, revisit then.
