---
'@bach/gpu-fx': minor
---

Phase 4 / Sprint 23-24 — Akustik foundations.

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
