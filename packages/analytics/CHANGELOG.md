# @bach/analytics

## 1.0.0

### Minor Changes

- 9b0d898: Sprint 38 — `@bach/analytics` QoE foundations.

  New package shipping a privacy-by-default QoE pipeline: schema-strict
  event taxonomy, swappable storage backend (IndexedDB / in-memory /
  custom), opt-in upload, and a declarative `<bach-analytics>` element
  that wires everything to the host player on connect.

  Public surface:

  - `createRecorder({ store, session, now })`: fills `id` + `ts`,
    rejects unknown event types so a stray write cannot pollute the
    log.
  - `createIndexedDbStore({ dbName, storeName, indexedDB })`:
    persistent backend. Falls back to no-op silently when IndexedDB
    is unavailable so analytics never break playback.
  - `createMemoryStore()`: in-memory `QoeStore` for tests + SSR.
  - `attachCollector({ host, recorder })`: subscribes to the host
    video and `bach:conduct-*` events; writes one QoE event per
    change, fires `session-end` on disconnect.
  - `createUploader({ store, transport, getConsent, batchSize })`:
    opt-in batch uploader. Re-checks consent before every flush; a
    denial silently drops the batch. `drain()` loops until the store
    empties or consent is withdrawn.
  - `createFetchTransport(endpoint)`: default `fetch`-based transport.
  - `<bach-analytics session>` + `/define`: declarative shell.

  Numbers:

  - 24 unit tests (events 7, store 8, uploader 9).
  - @bach/analytics size: 1.84 KB brotli / 4 KB budget.

### Patch Changes

- Updated dependencies [6c39365]
- Updated dependencies [b942a5d]
- Updated dependencies [4c04e55]
  - @bach/core@0.1.0
