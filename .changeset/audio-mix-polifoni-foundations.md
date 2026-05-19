---
'@bach/audio-mix': minor
---

Phase 4 / Sprint 20-22 — Polifoni foundations.

New package `@bach/audio-mix` ships the multi-track Web Audio surface
the Polifoni signature needs. Every piece is parser-agnostic over a
structural `AudioContextLike`, so happy-dom unit tests cover the whole
runtime without spinning up a real `AudioContext`.

- `crossfade` — pure curve helpers (`equal-power`, `linear`,
  `logarithmic`) plus `sampleCrossfadeCurve(curve, samples)` that emits
  the `Float32Array` pair `AudioParam.setValueCurveAtTime()` wants. The
  equal-power invariant `gainA² + gainB² ≈ 1` is asserted across every
  sample in the test suite. `gainToDb` / `dbToGain` round-trip safely.
- `createTimeSync({ master, slaves, thresholdSeconds, onResync })` —
  drift watcher that snaps any slave outside the 50 ms band on each
  `tick()`. Pure helper `wouldResync` exposes the predicate for QoE
  telemetry.
- `createMixer({ context, fftSize })` — owns `master.gain → analyser →
  destination`. `addTrack({ id, node | media, gain })`, `removeTrack`,
  `getTrack`, `crossfade(a, b, { curve, duration, resolution })`,
  `setGain`, `sampleSpectrum(out?)`, `dispose`.
- `<bach-audio-mix>` + `<bach-audio-track>` — declarative shell.
  Resolves the host player via `closest('bach-player')`, wraps its
  video as the master, walks child tracks on connect, fires a
  `bach:spectrum` CustomEvent each animation frame so visual overlays
  can subscribe.

Numbers:
  - 37 unit tests (crossfade 16, time-sync 7, mixer 14).
  - 295 unit tests across the monorepo.
  - @bach/audio-mix size: 1.73 KB brotli / 6 KB budget.
