---
'@bach/captions-ai': minor
---

Sprint 11 — Transformers.js binding + opt-in consent UX.

New subpath export `@bach/captions-ai/whisper`:

- `createWhisperEngine({ pipeline })` adapts the Transformers.js
  `automatic-speech-recognition` pipeline to the abstract
  `TranscriptionEngine` interface. Consumers import `pipeline` from
  `@huggingface/transformers` themselves and pass it in, so the binding
  bundle stays at 553 B brotli and the heavy ONNX runtime is never
  pulled in implicitly.
- Maps Transformers.js chunk timestamps (`[start, end | null]`) to
  Bach `Segment`s, drops chunks with missing end times or empty text.
- Auto-falls back from WebGPU to WASM when the first `pipeline()` call
  rejects — older Chromiums that advertise WebGPU but fail at adapter
  request still get captions.
- `language: 'auto'` omits the language key so Whisper's built-in
  detector kicks in; explicit ISO codes pass straight through.
- `markModelCached(modelId)` mirrors the Cache API probe for tests
  and self-hosted weight setups.

New element `<bach-captions-consent>`:

- Modal-style opt-in dialog inside the player's coordinate space.
  Renders the model's download size (39 MB / 74 MB / 244 MB) and two
  buttons backed by stable parts (`consent-accept`, `consent-decline`,
  `consent-card`, `consent-heading`, `consent-body`, `consent-size`,
  `consent-progress`).
- `resolve()` reads the Cache API and the persisted decision, opens
  the dialog only when state is `unknown`.
- `setProgress(fraction)` switches the dialog to a `loading` state
  and updates a `<progress>` bar — wire it to
  `createWhisperEngine({ onProgress })` and the user sees a live
  download bar.
- Dispatches a `bach:captions-consent` CustomEvent with the user's
  decision and the chosen model. The decision is persisted in
  localStorage under `bach:captions-ai:permission`.
- Localisable via slots (`heading`, `body`, `accept`, `decline`).

Numbers:
  - 17 new tests (whisper-engine 7, consent-element 10).
  - 60 tests across the package (was 43).
  - Brotli sizes: 4.58 KB main / 553 B whisper subpath / 8 KB + 3 KB budgets.
