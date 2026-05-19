# @bach/audio-mix

Multi-track Web Audio mixing for Bach Media Player — equal-power crossfade, master/slave drift sync, spectral analyzer overlay feed.

```bash
pnpm add @bach/audio-mix
```

## Pieces

- `createMixer({ context })` — `master.gain → analyser → destination` topology, track add / remove, gain control, `crossfade(a, b, { curve, duration })`, `sampleSpectrum()`.
- `crossfadeAt(curve, t)` and `sampleCrossfadeCurve(curve, samples)` — pure helpers for `equal-power`, `linear`, `logarithmic`.
- `gainToDb(gain)` / `dbToGain(db)` — round-trip safe.
- `createTimeSync({ master, slaves, thresholdSeconds, onResync })` — call `tick()` on `timeupdate` to keep auxiliary tracks within 50 ms of the host video.
- `<bach-audio-mix>` + `<bach-audio-track>` — declarative shell that wires an `AudioContext`, registers the host video as the master, and registers each child track. Emits `bach:spectrum` per animation frame.

## License

MIT
