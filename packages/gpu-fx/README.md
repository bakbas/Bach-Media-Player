# @bach/gpu-fx

WebGPU shader pipeline for Bach Media Player — color grade, blur, watermark, 3D LUT, film grain. The first publishing slice (Sprint 23-24) ships the descriptors, the WGSL sources, the LUT parser, the colour-grade math, and the declarative element; the runtime pipeline that consumes them lands in Sprint 25 alongside the WebGL2 fallback path.

## Pieces

- `Effect` discriminated union + `normaliseChain` / `mergeChains` so presets and user tweaks compose without aliasing.
- `colorGradeUniforms(effect)` + `applyColorGrade(buffer, uniforms, out)` — CPU reference and shader uniform packing.
- `parseCubeLut(source)` / `identityLut(size)` — strict Adobe `.cube` parser, identity-LUT helper.
- `FRAGMENT_SHADERS` + `FULLSCREEN_VERT` — WGSL strings for every pass.
- `PRESETS` — four curated chains (`cinematic`, `broadcast`, `vintage`, `minimal`).
- `acquireDevice({ gpu, powerPreference })` + `isWebGpuSupported(gpu?)` — adapter-side feature detect, swappable in tests.
- `<bach-gpu-fx preset="cinematic">` + `/define` — fires `bach:gpu-fx-chain` so the (Sprint 25) pipeline can swap shader passes without polling.

## License

MIT
