# @bach/seek-frame

## 1.0.0

### Minor Changes

- cab80d1: Phase 3 / Sprint 15-16 — Hassasiyet pipeline foundations.

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

- 07e111b: Phase 3 / Sprint 17-18 — MP4Box source, scrub engine, element.

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

- 5eff199: Sprint 39 — Scene-aware seek preview helpers.

  Adds a histogram-based scene detector that runs over the dense scrub
  thumbnail strip. The host UI can now mark scene boundaries on the
  progress bar so a viewer dragging the scrubber lands on the right beat
  without watching every frame in between.

  Public surface:

  - `computeHistogram(pixels, { bins })`: bucket an RGBA buffer into a
    normalised RGB histogram. Alpha is ignored so transparent regions
    do not register as fake cuts.
  - `histogramDistance(a, b)`: half-L1 distance in [0, 1]. Identical
    histograms give 0; disjoint histograms give 1.
  - `detectScenes(thumbs, { threshold, minGap, bins })`: returns the
    list of `SceneBoundary` indices where adjacent thumbnails cross
    the threshold. `minGap` collapses near-duplicate boundaries
    (typical of lightning flashes or hard cuts inside the same scene).

  Design notes:

  - Heuristic, not ML — runs on the existing dense strip, no model
    download, no extra decode work, ~1 KB of code.
  - Catches hard cuts reliably; soft transitions (fades, slow pans)
    stay below threshold by design — they belong in the 1.1 ML model.
  - Pure data API: a `Thumbnail` is `{ data, width, height, time }`,
    so the caller is free to pull pixels from `VideoFrame.copyTo`,
    an off-screen `<canvas>`, or any other source.

### Patch Changes

- Updated dependencies [6c39365]
- Updated dependencies [b942a5d]
- Updated dependencies [4c04e55]
  - @bach/core@0.1.0
