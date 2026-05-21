# @bach/analytics

QoE analytics for Bach Media Player. IndexedDB-backed event store, opt-in upload, schema-strict event taxonomy. No event leaves the device unless `getConsent()` returns true.

```bash
pnpm add @bach/analytics
```

```ts
import '@bach/core/define';
import '@bach/analytics/define';
```

```html
<bach-player>
  <video slot="media"></video>
  <bach-analytics></bach-analytics>
</bach-player>
```

```ts
const el = document.querySelector('bach-analytics')!;
const events = await el.store?.query();
```

## Surface

- `createRecorder({ store, session, now })` — fills `id` and `ts`, validates the event type against the open schema, writes to any `QoeStore`.
- `createIndexedDbStore({ dbName, storeName })` — persistent event log. Falls back to no-op when IndexedDB is missing (Safari private mode, SSR, etc.).
- `createMemoryStore()` — in-memory fallback / test harness with the same `QoeStore` shape.
- `attachCollector({ host, recorder })` — subscribes to the host's video + `bach:*` events and writes one QoE event per change. Returns an unsubscribe.
- `createUploader({ store, transport, getConsent, batchSize })` — opt-in batch uploader. Re-checks consent before every flush; a denial silently drops the batch.
- `createFetchTransport(endpoint)` — default `fetch`-based transport for the uploader.
- `<bach-analytics session>` element + `/define` — declarative shell. Picks the IndexedDB store when available, else memory; attaches the collector on connect.

## Event taxonomy

Open schema; consumers can read additional fields on `data` without a migration. Documented types: `session-start`, `session-end`, `src-change`, `loadstart`, `loadedmetadata`, `playing`, `pause`, `rebuffer`, `ratechange`, `seek`, `error`, `captions-toggle`, `fx-applied`, `theme-applied`, `conduct-applied`, `conduct-rejected`.

## License

MIT
