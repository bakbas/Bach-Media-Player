---
'@bach/gpu-fx': minor
---

Phase 4 finale — Akustik pipeline spec + Canvas fallback + playground.

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
