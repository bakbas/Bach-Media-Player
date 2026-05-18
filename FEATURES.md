# Features

This document enumerates every capability Bach Media Player will ship, grouped into three layers:

1. **Five signature differentiators** — the reasons to choose Bach over Video.js / Plyr / Shaka.
2. **Baseline** — table-stakes any modern web media player must deliver.
3. **Theming baseline** — what makes Bach the easiest player to style, including from an AI prompt.

Status legend: `[ ]` planned · `[~]` in-progress · `[x]` shipped.

---

## 1. Signature differentiators

### 1.1 Notasyon — `@bach/captions-ai` (Phase 2)

In-browser AI captioning. No server, no API key, no audio leaves the device.

- [ ] Transformers.js + Whisper-tiny (39 MB) and Whisper-base (74 MB) models.
- [ ] WebGPU acceleration when available, WASM SIMD fallback.
- [ ] AudioWorklet chunker: 30 s sliding window, 16 kHz mono PCM.
- [ ] Timing aligner with 1–2 s catch-up resync after first chunk.
- [ ] Caption renderer: overlay layer + `<track>` injection (for native captions UI).
- [ ] Opt-in download UX with explicit size disclosure + Cache API persistence.
- [ ] Self-host model URL override for enterprise / air-gapped use.
- [ ] Privacy assertion E2E: network monitor confirms zero audio bytes leave the page.

### 1.2 Hassasiyet — `@bach/seek-frame` (Phase 3)

Frame-accurate seek and frame-by-frame stepping for review / QC workflows.

- [ ] MP4Box.js keyframe / SAP indexer.
- [ ] WebCodecs `VideoDecoder` wrapper, decode-on-demand from indexed offsets.
- [ ] `frame-stepper`: previous/next frame, jump-to-frame-N.
- [ ] `scrub-engine`: high-density pointer preview (sub-pixel thumb).
- [ ] LRU frame cache (configurable bytes budget).
- [ ] `currentTime`-based fallback when WebCodecs is unavailable (Safari < 16, etc.).
- [ ] Pixel-perfect E2E snapshot proof.

### 1.3 Polifoni — `@bach/audio-mix` (Phase 4)

Multi-track audio mixing inside the browser — director commentary, alt languages, isolated stems.

- [ ] `AudioContext` graph with per-track `GainNode` + master bus.
- [ ] Equal-power crossfader.
- [ ] Master/slave time sync between tracks, < 50 ms drift target.
- [ ] Spectral analyzer overlay (`AnalyserNode`).
- [ ] Track add/remove at runtime without resync glitch.

### 1.4 Akustik — `@bach/gpu-fx` (Phase 4)

Real-time GPU video effects without server-side transcoding.

- [ ] WebGPU context with `importExternalTexture(video)` zero-copy path.
- [ ] WGSL shader library: color grade, blur region (PII), watermark, 3D LUT (`.cube` loader), film grain.
- [ ] Preset chain composition (effects stack, reorderable).
- [ ] WebGL2 fallback path (simplified color grading only).
- [ ] Performance gate: 1080p60 with 3-pass chain under 16 ms/frame budget on M-series / RTX.

### 1.5 Conducting — `@bach/conduct` (Phase 5) — world-first

Livestreamer changes the player UI for **every viewer** in real time. The killer collaborative feature.

- [ ] Wire protocol `bach.conduct.v1` over WebSocket (binary frames) + SSE fallback.
- [ ] Theme manifest schema v1: CSS variable deltas, layout preset switch, accent / typography swap.
- [ ] Manifest signing with broadcaster's Ed25519 private key; viewer verifies with public key.
- [ ] Strict whitelist apply: only declared CSS variables and layout enum values; **arbitrary HTML / script / CSS rejected at parser level**.
- [ ] Latency target: p95 broadcaster→viewer apply < 100 ms.
- [ ] Lag detection: stale manifest drop, last-known good rollback.
- [ ] Recording: manifest events embedded in VOD timeline → replay reproduces every UI change.
- [ ] Director SPA (`apps/director`): visual theme editor, live preview, push button, AI assist.
- [ ] Fuzz harness: 1000+ malicious manifest inputs, XSS leakage must stay at zero.

---

## 2. Baseline (every phase keeps these green)

- [ ] HLS playback via `@bach/engine-hls` (hls.js adapter).
- [ ] DASH playback via `@bach/engine-dash` (Shaka Player adapter).
- [ ] Multi-DRM: Widevine + FairPlay + optional PlayReady (EME orchestrator in `@bach/core`).
- [ ] Codec capability negotiation: AV1 → HEVC → H.264 via `MediaCapabilities`.
- [ ] WCAG 2.2 AA compliance (ADA Title II effective 28 Apr 2026).
- [ ] Muted-autoplay default + user-gesture fallback path.
- [ ] iOS WKWebView graceful degradation (native HLS auto-fallback, no MSE).
- [ ] Bundle budget: `@bach/core` ≤ 100 KB gzipped; size-limit CI gate per PR.
- [ ] Plugin API: `BachPlugin` interface, `bach:*` namespaced `CustomEvent`s.
- [ ] Opt-in install model — users only install packages they use.

---

## 3. Theming baseline (Phase 1, the AI vibe coder hook)

Anyone — human or model — should be able to skin the player on the first prompt. Five mechanisms, layered from simple to powerful:

- [ ] **CSS custom properties** with stable, documented names. Initial token contract:
  - `--bach-color-bg`, `--bach-color-fg`, `--bach-color-accent`, `--bach-color-muted`
  - `--bach-radius`, `--bach-control-size`, `--bach-control-gap`
  - `--bach-progress-track`, `--bach-progress-fill`, `--bach-progress-buffer`
  - `--bach-font-family`, `--bach-font-size`
  - `--bach-overlay-bg`, `--bach-overlay-blur`
- [ ] **Shadow DOM `::part()` map** — stable part names on every interactive element:
  `play-button`, `pause-button`, `progress-bar`, `progress-thumb`, `timeline`,
  `volume-slider`, `volume-button`, `caption-overlay`, `caption-cue`, `settings-menu`,
  `fullscreen-button`, `pip-button`, `time-display`, `chrome`.
- [ ] **Slot composition** — every chrome region (`controls`, `overlay`, `loading`, `error`) replaceable with the user's own component.
- [ ] **Headless mode** — `<bach-player headless>` exposes state + API with zero default UI.
- [ ] **Runtime `applyTheme(themeJson)`** — JSON manifest, no reload required. `theme.json` v0 schema (Phase 1), expanded v1 schema (Phase 5).
- [ ] **`@bach/themes`** (Phase 5): five curated presets — Minimal, Cinematic, Broadcast, Terminal, Vintage.
- [ ] **`@bach/tailwind`** (Phase 5): Tailwind preset plugin exposing all tokens.
- [ ] **`llms.txt`** (Phase 5): ML-readable theming reference so a model writes correct CSS on the first try.
- [ ] **AI theme assist** (Phase 5): natural-language theme generation in playground (`"neon synthwave"` → applied live).
