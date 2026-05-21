---
'@bach/seek-frame': minor
---

Sprint 39 — Scene-aware seek preview helpers.

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
