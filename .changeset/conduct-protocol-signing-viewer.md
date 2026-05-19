---
'@bach/conduct': minor
---

Phase 5 / Sprint 28-30 — Conducting foundations (5. imza özellik).

New package `@bach/conduct` ships the wire protocol, Ed25519 signing,
safety guards, viewer controller, and the `<bach-conduct>` declarative
element. The broadcaster SDK and director SPA arrive in Sprint 31.

- `protocol`: `bach.conduct.v1` wire format with manifest, ping, pong,
  error, subscribe frames. `canonicalManifest()` produces a sort-stable
  signing input so reordering keys does not break verification.
- `signing`: Ed25519 over Web Crypto SubtleCrypto. `signManifest`,
  `verifyManifest`, `importVerifyKey`, `importSignKey`,
  `generateKeyPair`, plus url-safe base64 helpers. A `SubtleLike` shim
  lets unit tests pass a deterministic checksum stand-in instead of a
  real adapter.
- `guards`: `createRateLimiter` (10 manifest/s default), `createSequence
  Guard` (replay protection), `dampenColorIfReduced` (clamps colour
  deltas when prefers-reduced-motion is set).
- `viewer`: `createConductViewer({ transport, host, verifyKey })`
  orchestrates the pipeline — decode → sequence guard → rate limit →
  signature verify → host.applyTheme. Every reject path fires
  `onReject` with one of: malformed, unknown-frame, bad-signature,
  replay, rate-limited, apply-failed.
- `<bach-conduct channel="..." verify-key="...">` + `/define`:
  declarative entry point. Decodes the base64url public key, imports
  it through SubtleCrypto, opens the WebSocket, wires the viewer to
  the closest `<bach-player>`. Dispatches `bach:conduct-applied` /
  `bach:conduct-rejected` so telemetry layers can subscribe.

Numbers:
  - 30 unit tests (protocol 8, signing 6, guards 10, viewer 6).
  - 382 unit tests across the monorepo.
  - @bach/conduct size: 1.79 KB brotli / 8 KB budget.
