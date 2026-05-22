# @bach/conduct

## 1.0.0

### Minor Changes

- e787d24: Sprint 31 — broadcaster SDK + manifest fuzz harness.

  - `createConductBroadcaster({ signKey, send, subtle?, startSeq?, now? })`:
    signs a `ThemeManifest`, wraps it into a `bach.conduct.v1` frame
    with a monotonic sequence number, hands the encoded payload to the
    caller-supplied `send` callback. `nextSeq` and `startSeq` expose
    the cursor so reconnect / resume is straightforward.
  - `generateFuzzCases()` + `runFuzz(apply, cases?)`: hand-crafted
    attack battery (HTML escape, `url(...)`, `expression()`,
    `javascript:`/`data:` URIs, CSS block breakout, unicode escapes,
    oversized strings) crossed with every documented Bach CSS variable
    - unknown-key sneaks + non-string values + manifest-not-an-object
      variants. The harness asserts the parser leaves `applied` empty
      for every case — release blocks when `report.failures.length > 0`.

  Numbers:

  - 8 new unit tests (broadcaster 4, fuzz 4).
  - 38 unit tests across `@bach/conduct` (was 30).
  - 390+ unit tests across the monorepo.
  - The fuzz suite exercises 340+ malicious manifests against the
    real `@bach/core/applyTheme` and finds zero leakage.
  - @bach/conduct size: 2.56 KB brotli / 8 KB budget.

- 018554f: Phase 5 / Sprint 28-30 — Conducting foundations (5. imza özellik).

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

### Patch Changes

- Updated dependencies [6c39365]
- Updated dependencies [b942a5d]
- Updated dependencies [4c04e55]
  - @bach/core@0.1.0
