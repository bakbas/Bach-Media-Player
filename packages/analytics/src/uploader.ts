import type { QoeEventBase } from './events.js';
import type { QoeStore } from './store.js';

/**
 * Opt-in QoE uploader. Reads from the store in batches, POSTs them to
 * a caller-supplied endpoint, and drops the batch on success. Consent
 * is a hard requirement: the uploader refuses to fire unless
 * `getConsent()` resolves to `true`, and a denial drops the in-flight
 * batch without sending anything.
 *
 * The transport is abstract — the default uses `fetch`, but consumers
 * can plug in `sendBeacon` for page-unload flushes, or a Cloudflare
 * Workers AI gateway that signs each payload.
 */

export interface UploadTransport {
  send(payload: ReadonlyArray<QoeEventBase>): Promise<boolean>;
}

export interface UploaderOptions {
  store: QoeStore;
  transport: UploadTransport;
  /** Has the user opted in? Re-checked before every upload. */
  getConsent: () => boolean | Promise<boolean>;
  /** Max events per upload. Default 100. */
  batchSize?: number;
  /** Clock for tests. */
  now?: () => number;
}

export interface Uploader {
  /** Flush one batch. Resolves to the number of events shipped. */
  flush(): Promise<number>;
  /** Flush everything in a loop until the store drains. */
  drain(): Promise<number>;
}

const DEFAULT_BATCH = 100;

export function createUploader(opts: UploaderOptions): Uploader {
  const batchSize = Math.max(1, opts.batchSize ?? DEFAULT_BATCH);

  const flush = async (): Promise<number> => {
    const consent = await opts.getConsent();
    if (!consent) return 0;
    const all = await opts.store.query();
    if (all.length === 0) return 0;
    const batch = all.slice(0, batchSize);
    const ok = await opts.transport.send(batch);
    if (!ok) return 0;
    await opts.store.drop(batch.map((e) => e.id));
    return batch.length;
  };

  return {
    flush,
    async drain() {
      let total = 0;
      // Cap the loop at 64 batches per drain so a misbehaving relay
      // never wedges the page in an upload spin.
      for (let i = 0; i < 64; i += 1) {
        const sent = await flush();
        if (sent === 0) return total;
        total += sent;
      }
      return total;
    },
  };
}

/**
 * Convenience transport over `fetch`. The default content-type is
 * `application/json`; consumers wanting `sendBeacon` semantics on
 * page unload should construct their own transport — `fetch` has no
 * keep-alive guarantees during pagehide.
 */
export function createFetchTransport(endpoint: string): UploadTransport {
  return {
    async send(payload) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ events: payload }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}
