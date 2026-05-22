# @bach/gpu-fx

## 1.0.0

### Minor Changes

- a3d9edf: Phase 4 / Sprint 23-24 — Akustik foundations.

  New package `@bach/gpu-fx` ships the descriptors, WGSL sources, math
  helpers, LUT parser, presets, adapter detection, and the declarative
  element for the Akustik signature. The full multi-pass render
  pipeline lands in Sprint 25 alongside the WebGL2 fallback path; this
  slice gives every consumer the data shapes they need today and lets
  the playground swap presets visually as soon as the runtime arrives.

  Pure modules:

  - `effects`: discriminated union for the five passes
    (color-grade, lut, blur-region, watermark, film-grain),
    `normaliseChain` drops null entries and strips unknown effect
    types so a hostile theme manifest cannot register an arbitrary
    pass, `mergeChains` composes presets + user tweaks.
  - `color-grade`: BT.709 luma weights, `saturationMatrix(s)` with
    clamp and identity fallbacks, `colorGradeUniforms(effect)` that
    floors gamma to 0.001 (no shader divide-by-zero) and replaces
    non-finite scalars with documented defaults, `applyColorGrade`
    CPU reference that the WGSL pass mirrors.
  - `lut`: strict Adobe `.cube` parser — handles TITLE / DOMAIN_MIN /
    DOMAIN_MAX, rejects 1D LUTs and malformed triplets explicitly so
    the GPU side never allocates a texture for bad data. `identityLut`
    helper for fallback and tests.
  - `shaders`: WGSL strings for every pass plus a shared fullscreen
    vertex stage. Inlined as TS exports so consumers do not need a
    bundler plugin.
  - `presets`: four curated chains — cinematic, broadcast, vintage,
    minimal — each composed of registered effect types only.
  - `device`: structural `GPULike` interface + `acquireDevice` /
    `isWebGpuSupported`. Tests pass shims; the runtime reads
    `navigator.gpu`.

  Element:

  - `<bach-gpu-fx preset="cinematic">` + `/define`. Resolves the
    preset attribute, merges with the explicit chain set via
    `setChain(...)`, fires `bach:gpu-fx-chain` on connect, on every
    attribute change, and on every `setChain` call. `disabled`
    attribute hides the chain entirely.

  Numbers:

  - 45 unit tests (effects 7, color-grade 11, lut 9, presets 4,
    device 7, element 7).
  - 340 unit tests across the monorepo.
  - @bach/gpu-fx size: 2.74 KB brotli / 10 KB budget.

- e6df437: Phase 4 finale — Akustik pipeline spec + Canvas fallback + playground.

  Two new public modules close out the data layer for the WebGPU runtime:

  - `buildPipelineSpec({ effects, resolution, now })` translates an
    effect chain into the data the GPU layer needs per pass: WGSL
    vertex + fragment source, packed uniform bytes (matching the std140
    layout in `shaders.ts`), and auxiliary resource handles for LUTs
    and watermark images. Reusing the same input yields the same pass
    ids so the runtime can keep its compiled `GPURenderPipeline` cache.
    Unknown effect types drop silently — the runtime sees only sources
    it knows how to instantiate.
  - `createCanvasFallback({ output, colorGrade })` ships the Phase 4
    fallback path. When WebGPU is missing, the consumer can still drive
    the color-grade pass through the existing `applyColorGrade` CPU
    reference and a hidden `OffscreenCanvas` (or `<canvas>` on
    iOS Safari). Other passes are dropped silently; the goal is
    graceful degradation, not feature parity.

  Playground gains a Phase 4 demo panel:

  - Four GPU FX preset buttons (Cinematic / Broadcast / Vintage /
    Minimal) plus an explicit Off. Each click flips the
    `<bach-gpu-fx>` element's `preset` attribute, fires
    `bach:gpu-fx-chain`, and shows the resolved pipeline spec
    (pass ids + uniform byte counts) in the output pane.

  Numbers:

  - 12 new unit tests (pipeline-spec 8, fallback 4).
  - 57 unit tests across @bach/gpu-fx (was 45).
  - @bach/gpu-fx size: 3.62 KB brotli / 10 KB budget.

### Patch Changes

- Updated dependencies [6c39365]
- Updated dependencies [b942a5d]
- Updated dependencies [4c04e55]
  - @bach/core@0.1.0
