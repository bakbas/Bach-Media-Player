---
'@bach/seek-frame': minor
---

Phase 3 / Sprint 17-18 — MP4Box source, scrub engine, element.

Three additions that complete the Hassasiyet runtime surface:

- `createMp4BoxSource({ MP4Box, data })`: structural binding to MP4Box.js.
  Consumer imports `* as MP4Box from 'mp4box'` and passes the namespace
  in. Walks the parsed sample table, converts track-tick timestamps to
  seconds via `sampleToFrame`, and returns a built `KeyframeIndex`
  alongside the codec string and per-frame byte slices the decoder
  controller needs.
- `createScrubEngine({ stepper, index, strategy })`: pointer-preview
  driver with two strategies — `keyframe-only` (cheap, hover → preceding
  sync sample) and `dense` (warmup pre-decodes N evenly spaced
  thumbnails so hover is a constant-time lookup). Both paths debounce
  hover events so aggressive scrubbing does not blow up the decoder
  queue. `denseThumbnailPlan` exposes the time / frame pairs the
  strategy would fill, for callers that want to render a static strip
  without instantiating a stepper.
- `<bach-seek-frame>` Custom Element + `/define` subpath: opt-in shell
  that wires a stepper to the host player and surfaces step primitives
  as DOM methods (`at`, `step`, `prev`, `next`) plus keyboard shortcuts
  ("," / "." matching ffplay / Resolve). Fires `bach:frame` after every
  successful delivery so the host UI can paint without polling.

Numbers:
  - 18 new unit tests (mp4box-source 6, scrub-engine 6, element 6).
  - 55 unit tests across @bach/seek-frame (was 37).
  - @bach/seek-frame size: 2.52 KB brotli / 6 KB budget.
