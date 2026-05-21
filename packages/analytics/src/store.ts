import {
  type QoeEventBase,
  type QoeEventDraft,
  type QoeFilter,
  isKnownEventType,
  matchesFilter,
} from './events.js';

/**
 * Abstract storage backend. The runtime ships an IndexedDB and an
 * in-memory implementation; consumers can plug in their own (Cloudflare
 * Durable Object, OPFS, etc.) without touching the recorder API.
 *
 * Every method is async because IndexedDB demands it; the in-memory
 * stand-in keeps the same signature so tests do not fork.
 */
export interface QoeStore {
  put(event: QoeEventBase): Promise<void>;
  query(filter?: QoeFilter): Promise<QoeEventBase[]>;
  /** Atomically delete N oldest events. Used after a successful upload. */
  drop(ids: ReadonlyArray<number>): Promise<void>;
  /** Drop everything. Caller-driven privacy reset. */
  clear(): Promise<void>;
  /** Total event count (post-filter) — for the upload throttle. */
  count(filter?: QoeFilter): Promise<number>;
}

export interface RecorderOptions {
  store: QoeStore;
  /** Stable per-session id. Defaults to a fresh UUIDv4 on each call. */
  session?: string;
  /** Clock for tests. */
  now?: () => number;
}

export interface Recorder {
  record(draft: QoeEventDraft): Promise<QoeEventBase>;
  readonly session: string;
}

function defaultNow(): number {
  return Date.now();
}

function uuid(): string {
  // Web Crypto when available, deterministic-ish fallback otherwise.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `bach-${Math.floor(Math.random() * 1e12).toString(36)}`;
}

/**
 * Build a recorder bound to a session id. The recorder is intentionally
 * tiny — its only job is to fill in `id` (delegated to the store) and
 * `ts` (caller can override). Schema validation happens here too so
 * unknown event types do not pollute the store.
 */
export function createRecorder(opts: RecorderOptions): Recorder {
  let cursor = 0;
  const session = opts.session ?? uuid();
  const now = opts.now ?? defaultNow;

  return {
    session,
    async record(draft) {
      if (!isKnownEventType(draft.type)) {
        throw new Error(`Bach analytics: unknown event type "${draft.type}"`);
      }
      cursor += 1;
      const event: QoeEventBase = {
        id: cursor,
        ts: draft.ts ?? now(),
        session: draft.session,
        type: draft.type,
        data: draft.data ?? {},
      };
      await opts.store.put(event);
      return event;
    },
  };
}

/**
 * In-memory store. Used by tests and as a fallback when IndexedDB is
 * unavailable (Safari private browsing, Node-side renderers, etc.).
 */
export function createMemoryStore(): QoeStore {
  const events: QoeEventBase[] = [];
  return {
    async put(event) {
      events.push(event);
    },
    async query(filter) {
      if (!filter) return events.slice();
      return events.filter((e) => matchesFilter(e, filter));
    },
    async drop(ids) {
      const set = new Set(ids);
      for (let i = events.length - 1; i >= 0; i -= 1) {
        const event = events[i];
        if (event && set.has(event.id)) events.splice(i, 1);
      }
    },
    async clear() {
      events.length = 0;
    },
    async count(filter) {
      if (!filter) return events.length;
      return events.filter((e) => matchesFilter(e, filter)).length;
    },
  };
}
