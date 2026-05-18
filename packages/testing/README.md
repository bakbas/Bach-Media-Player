# @bach/testing (internal)

Mocks and fixtures shared across Bach Media Player test suites. **Not published to npm.**

Exports:

- `FakeMediaElement` — minimal `HTMLMediaElement`-shaped fake (state, listeners, `buffered`, `play()`, `pause()`).
- `buildSyntheticHlsPlaylist` — deterministic VOD or live-style HLS playlist generator for unit-level engine tests.

Future additions (Phases 1–5):

- `MediaSource` / `SourceBuffer` mock.
- `MediaKeys` / `MediaKeySession` (EME) mock.
- `VideoDecoder` (WebCodecs) mock with deterministic frame output.
- Conduct WebSocket mock with simulated jitter and signature flows.
