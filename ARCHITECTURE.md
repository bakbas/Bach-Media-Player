# Architecture

This document explains how Bach Media Player is wired together. It complements [`FEATURES.md`](./FEATURES.md) (what we build) and [`ROADMAP.md`](./ROADMAP.md) (when we build it).

## Pillars

1. **Web Components first.** `<bach-player>` is a Custom Element. Everything else — controls, captions, FX layers — is also a Custom Element. The framework wrappers (`@bach/react`, future Vue / Svelte) are thin adapters around the same DOM contract.
2. **One element, many slots.** Composition is the API. The user assembles a player by nesting elements; we do not expose a single mega-config object.
3. **Engine adapters, not engines.** We do not reimplement HLS or DASH parsing. `@bach/engine-hls` adapts hls.js; `@bach/engine-dash` adapts Shaka. Adapters share a `MediaEngine` interface so the codec negotiator can swap engines without UI knowing.
4. **Signals for state.** `@preact/signals-core` (~2 KB) drives fine-grained reactivity inside Shadow DOM. UI elements subscribe directly to the slices they read.
5. **Theming is contract.** CSS variable names and `::part()` names are public API. Renaming a part is a breaking change after `1.0.0`.

## Element graph

```
<bach-player>                       ← orchestrator; owns state, EME, engine
├─ <video slot="media">             ← user-supplied <video> element (or auto-created)
├─ <bach-controls slot="controls">  ← @bach/ui — fully replaceable via slot
│  ├─ <bach-play-button>            ← part="play-button"
│  ├─ <bach-progress>               ← part="progress-bar" / "progress-thumb"
│  ├─ <bach-volume>                 ← part="volume-slider" / "volume-button"
│  └─ <bach-time>                   ← part="time-display"
├─ <bach-captions>                  ← @bach/captions-ai (optional)
├─ <bach-audio-mix>                 ← @bach/audio-mix (optional)
├─ <bach-gpu-fx>                    ← @bach/gpu-fx (optional)
└─ <bach-conduct>                   ← @bach/conduct (optional; live director)
```

`<bach-player headless>` skips rendering the controls slot entirely and exposes only the imperative API + events.

## Data flow

```
       ┌─────────────────────────────────────────────────────────────────┐
       │                  signals state (in @bach/core)                  │
       │  src, currentTime, duration, paused, buffered, volume, muted,   │
       │  readyState, error, captions[], audioTracks[], theme, ...       │
       └────────────┬────────────────────────────────────┬───────────────┘
                    │ read                                │ write
                    │                                     │
       ┌────────────┴───────────┐               ┌─────────┴────────────┐
       │   UI components,        │               │   media engine        │
       │   captions overlay,     │               │   adapters, EME       │
       │   GPU effects, etc.     │               │   orchestrator,       │
       │   subscribe to slices.  │               │   conduct dispatcher  │
       └─────────────────────────┘               └───────────────────────┘
                    ▲                                     │
                    │   bach:* CustomEvents               │
                    └─────────────────────────────────────┘
```

State writes come from engines and user interactions; everything else is a reactive consumer.

## Engine adapter contract

```ts
export interface MediaEngine {
  readonly name: string;                 // "hls" | "dash" | "native"
  canHandle(src: string, mime?: string): Promise<boolean>;
  attach(video: HTMLVideoElement, opts: MediaEngineOptions): Promise<void>;
  load(src: string): Promise<void>;
  destroy(): Promise<void>;
  on<E extends keyof MediaEngineEvents>(event: E, handler: MediaEngineEvents[E]): () => void;
}
```

The **codec negotiator** in `@bach/core` asks `MediaCapabilities` what the device supports, then walks an ordered list of engines (DRM constraints first), picks the first that returns `canHandle === true`, and calls `attach()`. iOS Safari short-circuits to `engine-native` since MSE is unavailable.

## EME orchestrator

DRM lives in `@bach/core/eme/`. One state machine per CDM:

```
idle ──license-request──> requesting ──license-response──> active
                              └────error────> failed (renegotiate or surface)
```

Key system priority: Widevine → PlayReady → FairPlay (we pick whatever the platform actually supports). License servers are configured per source, not per player.

## Plugin lifecycle

Any third-party feature implements `BachPlugin`:

```ts
export interface BachPlugin {
  readonly id: string;                   // unique, e.g. "ads.vast"
  install(host: BachPlayer): void;       // called once after attach
  uninstall(): void;                     // called on detach or hot replace
}
```

Plugins talk to the player through:

- The signals state (read or augment).
- `bach:*` `CustomEvent`s on the host element.
- Direct method calls returned from `host.api` (typed).

## WebGPU pipeline (`@bach/gpu-fx`)

```
HTMLVideoElement
   │ importExternalTexture()
   ▼
GPU video texture ──▶ pass 1 (e.g. color grade) ──▶ pass 2 (e.g. LUT) ──▶ pass N ──▶ render target
                                                                                       │
                                                                                       ▼
                                                                              <canvas> overlay
```

Each pass is a WGSL fragment shader with a uniforms buffer. The chain is data-driven; presets are just ordered arrays of pass configs. On WebGL2 fallback, only the color-grade pass runs.

## Conduct protocol (`@bach/conduct`)

```
broadcaster (apps/director) ─── sign(manifest, ed25519_priv) ───▶ relay (WebSocket) ───▶ viewer
                                                                                         │
                                                                                         ▼
                                                              verify(manifest, ed25519_pub)
                                                              parse against strict schema
                                                              apply whitelisted CSS vars
                                                                  + layout enum only
                                                              record into VOD timeline
```

The relay is **not part of this repo**; we ship the protocol spec, the broadcaster SDK (`@bach/conduct/broadcaster`), and the viewer element (`<bach-conduct>`). A Cloudflare Workers reference implementation lives under `examples/conduct-relay-cf/`.

**Sandbox invariants** (security-critical, enforced in the parser before apply):

1. Manifest top level is a fixed-shape JSON object — unknown keys rejected.
2. `cssVariables` values match a regex per type (color → `oklch()` / hex / `currentcolor`; length → `<number>px` / `<number>rem` / `<number>%`; enum → fixed set).
3. `layout` value is one of a closed enum.
4. No properties may inject `<script>`, `<style>`, `url(...)`, or `expression(...)`.
5. Signature mismatch → entire manifest discarded silently; surfaced as `bach:conduct-rejected` event for telemetry.

## Build system

- **Library builds:** `tsup` per package (dual ESM + CJS + `.d.ts`).
- **App builds:** Vite (`apps/playground`), Astro (`apps/docs`), Vite (`apps/director`).
- **Task orchestration:** Turborepo with remote-cache-friendly outputs.
- **Type project references:** each package's `tsconfig.json` extends `tsconfig.base.json` and lists `references` on its workspace deps; root `pnpm typecheck` runs in dependency order via Turbo.

## Testing topology

- **Unit (Vitest + happy-dom):** co-located `*.test.ts` files. Mocks live in `packages/testing` (`MediaSource`, `HTMLMediaElement` extras, `MediaKeys`, `WebCodecs`, conduct WebSocket).
- **Component (Vitest browser mode):** `*.browser.test.ts` files, run via Playwright provider against real Chromium / WebKit. Used wherever Shadow DOM behaviour or layout matters.
- **E2E (Playwright):** `e2e/specs/`. Visual regression via `toHaveScreenshot()`. Synthetic HLS playlists generated at runtime from CC0 sample MP4s.
- **Performance:** the WebGPU benchmark lives in `e2e/perf/` and runs nightly on a dedicated GPU runner from Phase 4 onward.
