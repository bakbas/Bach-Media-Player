---
'@bach/captions-ai': minor
---

Phase 2 / Sprint 9-10 — Notasyon engine-agnostic pipeline.

New package `@bach/captions-ai` ships the building blocks for in-browser
AI captions. Transformers.js is declared as an optional peer dependency,
so consumers who bring their own transcription engine pay zero bytes for
it. Inside, the pipeline is split into four pure modules + one Web
Component, every one unit-testable without loading a 39 MB model:

- `createAudioChunker({ sourceSampleRate })`: ring buffer with linear
  resample to 16 kHz mono and 30 s sliding window / 5 s overlap. Handles
  interleaved stereo, arbitrary source rates, and bounded memory.
- `createTimingAligner()`: dedupes the overlap by punctuation-normalised
  text + midpoint hit-test, keeps segments sorted.
- `createTranscriptionController({ engine, onSegments })`: drain walker
  that serialises inferences (max one in-flight), offsets relative
  segment timestamps by the chunk start time, and recovers from per-chunk
  engine failures via `onError`.
- `<bach-captions>` element: overlay renderer + `<track kind="captions">`
  injection so the native UA captions menu reflects the same cues.
- `resolvePermission(model)`: opt-in download UX helper. Reads Cache API
  first (cached → no prompt), then localStorage (granted / denied),
  then `unknown` (caller surfaces a dialog).

The TranscriptionEngine interface is the single seam; tests pass fakes
and the Transformers.js binding will arrive in Sprint 11 (`/whisper`
subpath export).
