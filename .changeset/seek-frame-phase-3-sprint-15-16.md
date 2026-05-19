---
'@bach/seek-frame': minor
---

Phase 3 / Sprint 15-16 — Hassasiyet pipeline foundations.

The frame-accurate seek subsystem ships with the four primitives every
WebCodecs-driven workflow needs. Every module is parser-agnostic; the
MP4Box.js source adapter lands in Sprint 17 alongside the scrub-engine.

- `createKeyframeIndex(samples)` — pure data structure built from a flat
  sample table. Sorts by pts, records sync samples, exposes
  `findFrameAtTime`, `findPrecedingKeyframe`, `gopFor` (the slice a
  decoder needs to replay before emitting any target frame), and
  `stepFrame` (delta with range clamp).
- `createFrameCache({ maxBytes })` — byte-budgeted LRU keyed by frame
  index. Calls a per-entry `release()` on eviction so GPU `VideoFrame`s
  can `.close()` cleanly; entries larger than the budget are dropped
  instead of flushing the cache; release exceptions never break
  eviction.
- `createDecoderController(factory)` — wraps a `VideoDecoder`-shaped
  class through a structural type so the package compiles where
  WebCodecs is missing. Matches encoded chunks to decoder outputs by
  pts via a small pending list + early-output buffer; rejects pending
  decodes on `error()`; resets release buffered frames and reject
  outstanding promises.
- `createFrameStepper({ index, decoder, cache, fetchSampleBytes,
  toChunk })` — the public API. `at(time)`, `step(delta)`, `prev()`,
  `next()`, decode-on-demand: cache → preceding keyframe → replay the
  GOP → cache every emitted frame → return the target value.
- `createCurrentTimeFallback({ index, video })` — same surface for
  Safari < 17 and other no-WebCodecs browsers. Drives `currentTime`
  to the target frame's pts and resolves on `seeked`.

Numbers:
  - 37 unit tests (keyframe-index 14, frame-cache 8, decoder 7,
    frame-stepper 8).
  - @bach/seek-frame size: 1.46 KB brotli / 6 KB budget. mp4box stays
    fully external — when this package is not used the bundle pays
    nothing.

Sprint 17 follow-ups: MP4Box.js source adapter (`createMp4BoxSource`),
scrub-engine for the progress-bar pointer preview, and a
`<bach-seek-frame>` element that wires the stepper into the host
player's state.
