---
'@bach/conduct': minor
---

Sprint 31 — broadcaster SDK + manifest fuzz harness.

- `createConductBroadcaster({ signKey, send, subtle?, startSeq?, now? })`:
  signs a `ThemeManifest`, wraps it into a `bach.conduct.v1` frame
  with a monotonic sequence number, hands the encoded payload to the
  caller-supplied `send` callback. `nextSeq` and `startSeq` expose
  the cursor so reconnect / resume is straightforward.
- `generateFuzzCases()` + `runFuzz(apply, cases?)`: hand-crafted
  attack battery (HTML escape, `url(...)`, `expression()`,
  `javascript:`/`data:` URIs, CSS block breakout, unicode escapes,
  oversized strings) crossed with every documented Bach CSS variable
  + unknown-key sneaks + non-string values + manifest-not-an-object
  variants. The harness asserts the parser leaves `applied` empty
  for every case — release blocks when `report.failures.length > 0`.

Numbers:
  - 8 new unit tests (broadcaster 4, fuzz 4).
  - 38 unit tests across `@bach/conduct` (was 30).
  - 390+ unit tests across the monorepo.
  - The fuzz suite exercises 340+ malicious manifests against the
    real `@bach/core/applyTheme` and finds zero leakage.
  - @bach/conduct size: 2.56 KB brotli / 8 KB budget.
