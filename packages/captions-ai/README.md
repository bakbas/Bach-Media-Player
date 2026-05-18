# @bach/captions-ai

In-browser AI captions for Bach Media Player. Audio never leaves the device — Whisper inference runs locally via [Transformers.js](https://huggingface.co/docs/transformers.js).

```bash
pnpm add @bach/captions-ai @huggingface/transformers
```

`@huggingface/transformers` is an **optional** peer dependency. The package is split into a transcription-engine-agnostic core (chunker, aligner, controller, element) and a thin Transformers.js binding so consumers who already use another engine can plug it in.

## Quick start

```ts
import '@bach/core/define';
import '@bach/captions-ai/define';
```

```html
<bach-player src="video.m3u8">
  <video slot="media" crossorigin></video>
  <bach-captions language="auto" label="AI captions"></bach-captions>
</bach-player>
```

The element renders nothing until you call `setSegments()` from your transcription pipeline; the package ships:

- `createAudioChunker(opts)` — 30 s sliding window with 5 s overlap, resamples to 16 kHz mono.
- `createTranscriptionController({ engine, onSegments })` — orchestrates push → chunk → infer → emit.
- `createTimingAligner()` — dedupes overlapping segments.
- `resolvePermission(model)` — pre-prompt UX helper: tells you whether the model is cached, the user already granted, denied, or never asked.

## Privacy

This package goes to lengths to keep audio on-device:

- `TranscriptionEngine.transcribe` is the only seam; the default Transformers.js binding loads its weights from a CDN you choose (or self-host) and never POSTs audio bytes.
- The model download is **opt-in** with an explicit size disclosure (39 MB for `tiny`).
- The Phase 2 E2E suite asserts zero outbound requests carry audio data.

See [`SECURITY.md`](../../SECURITY.md) for the threat model.

## License

MIT
