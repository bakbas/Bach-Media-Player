# @bach/captions-ai

## 1.0.0

### Minor Changes

- e431408: Phase 2 / Sprint 9-10 — Notasyon engine-agnostic pipeline.

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

- 3144e18: Phase 2 finale — playground integration + privacy E2E coverage.

  The captions surface is now reachable from the public playground demo:

  - `<bach-captions>` + `<bach-captions-consent>` mounted inside the
    player. The "Enable captions" button surfaces the dialog; accepting
    drives the progress bar to 100 % and feeds a deterministic demo
    transcript into the aligner. Reviewers can verify cue rendering and
    dedupe behaviour without downloading the 39 MB Whisper model.

  Playwright suite gains four new specs:

  - consent dialog opens on first prompt; denial persists to
    localStorage.
  - accept flow drives progress, fills the transcript pane, advances the
    active cue as `currentTime` moves.
  - the demo feed can be called twice — the aligner keeps only one of
    each duplicate segment.
  - **privacy assertion** — the page is monitored throughout the
    captions flow and any request to a third-party host that uses an
    audio MIME type or an octet-stream POST body is flagged as a leak.
    The default fake-engine demo emits zero such requests; the test
    will fail loudly if a future change introduces a server round-trip.

  This closes the `0.2.0-alpha` work for Phase 2 (Notasyon).

- d9428f4: Sprint 11 — Transformers.js binding + opt-in consent UX.

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

### Patch Changes

- Updated dependencies [6c39365]
- Updated dependencies [b942a5d]
- Updated dependencies [4c04e55]
  - @bach/core@0.1.0
