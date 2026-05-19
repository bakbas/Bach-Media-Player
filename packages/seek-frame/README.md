# @bach/seek-frame

Frame-accurate seek for Bach Media Player. WebCodecs `VideoDecoder` + MP4Box.js keyframe index + a byte-budgeted LRU frame cache, with a `currentTime`-based fallback for browsers without WebCodecs.

```bash
pnpm add @bach/seek-frame mp4box
```

`mp4box` is an **optional** peer dependency. The package's core (index, decoder controller, frame cache, stepper) is parser-agnostic — pass any sample table and any decoder factory. The bundled MP4Box source ships in a follow-up sprint.

## Pieces

- `createKeyframeIndex(samples)` — sorts by pts, records sync-sample positions, supports `findFrameAtTime`, `findPrecedingKeyframe`, `gopFor`, `stepFrame`.
- `createFrameCache({ maxBytes })` — LRU keyed by frame index, evicts on byte budget, calls a per-entry `release()` for GPU cleanup.
- `createDecoderController(factory)` — wraps a `VideoDecoder`-shaped class, matches encoded chunks to output frames by pts, exposes a Promise-returning `decode()`.
- `createFrameStepper({ index, decoder, cache, fetchSampleBytes, toChunk })` — the API surface: `at(time)`, `step(delta)`, `prev()`, `next()`, decode-on-demand from the preceding keyframe.
- `createCurrentTimeFallback({ index, video })` — same API surface using `video.currentTime` for environments without WebCodecs.

## License

MIT
