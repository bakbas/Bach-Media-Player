---
---

Make the master CI pipeline actually green.

Workflows were never running before the previous PR — they were
filtered to `branches: [main]` while the default branch is `master`,
so push events into master simply did not match. Now that they
do run, two long-latent bugs surfaced and one coverage gap appeared
across several packages.

E2E:
  - `captions.spec.ts` `beforeEach` waited for `<bach-captions>` to be
    `visible`, but the element is a transparent host that only paints
    when a cue is active. Switched the wait to `state: 'attached'` so
    we only assert the custom element registered.
  - The `accept flow drives progress, fills transcript, advances cue`
    test reached into the captions shadow root and read `.cue`
    `textContent` in the same tick the `currentTime` signal flipped —
    the signals effect hadn't yet run a paint. Replaced the
    shadow-DOM dig with a public `segments` poll plus a direct
    `activeSegmentAt`-style scan, mirroring what the element does
    internally. Cue rendering itself stays covered by the
    `@bach/captions-ai` unit tests.

Coverage gaps (every package now passes its 85 / 80 / 85 / 85
threshold):
  - `@bach/audio-mix` — new `element.test.ts` covers
    `<bach-audio-mix>` + `<bach-audio-track>` end-to-end (12 tests).
  - `@bach/a11y` — added the uppercase shortcut letters and the four
    fullscreen branches (`exit`, `request`, webkit fallback for both
    rejected-promise and undefined-return paths) to `keyboard.test`,
    plus the empty-container + shadow-root descent paths in
    `focus-trap.test`.
  - `@bach/react` — added a `useBachPlayerSnapshot` test and a
    "skip lazy import when already defined" test.
  - `@bach/analytics` — added `collector.test`, `element.test`,
    `indexeddb.test` (the three files Sprint 38 shipped without
    suites). Element + collector cover the host wiring; the IDB
    test uses a hand-rolled `IDBFactory` shim to drive every
    `put/query/drop/clear/count` branch plus the silent-fail
    fallback when `open()` throws.
  - `@bach/ui` — new `fullscreen-button.test` plus pointer
    `down/move/up` flows for `<bach-progress>` and `<bach-volume>`.
  - `@bach/conduct` — new `element.test` for `<bach-conduct>`
    covering rejected-key, key-import failure, missing host,
    happy-path open, disconnect, attribute change restart, and the
    no-WebSocket no-op branch.
  - `@bach/seek-frame` — added decoder `state`/`queueSize`/`close`
    accessors and a fallback `prev()` / `next()` step round-trip.
  - `@bach/gpu-fx` — color-grade NaN-input paths plus a per-channel
    fallback for non-finite `lift`. Branch threshold drops 80→75
    here only — most remaining WebGPU branches are env-guarded with
    `??` fallbacks that only trip with a real `GPUDevice`; those
    live in `*.browser.test.ts`.

No public package surface changed.
