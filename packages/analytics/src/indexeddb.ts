import { type QoeEventBase, type QoeFilter, matchesFilter } from './events.js';
import type { QoeStore } from './store.js';

/**
 * IndexedDB-backed QoE store. One object store, one key path (`id`),
 * indexes on `session` and `ts` so dashboards can filter without a
 * full scan. The store is opened lazily on the first call so the
 * package never touches IndexedDB during SSR.
 *
 * Failure modes are deliberately silent: when IndexedDB is unavailable
 * or the open transaction is blocked, every method becomes a no-op
 * (or returns an empty array). Analytics must never break playback.
 */

export interface IndexedDbStoreOptions {
  /** Database name. Defaults to "bach-analytics". */
  dbName?: string;
  /** Object-store name. Defaults to "events". */
  storeName?: string;
  /** Optional IDBFactory override for tests. */
  indexedDB?: IDBFactory | undefined;
}

const DEFAULT_DB = 'bach-analytics';
const DEFAULT_STORE = 'events';

function resolveFactory(opts: IndexedDbStoreOptions): IDBFactory | null {
  if (opts.indexedDB) return opts.indexedDB;
  if (typeof indexedDB !== 'undefined') return indexedDB;
  return null;
}

function openDb(
  factory: IDBFactory,
  dbName: string,
  storeName: string,
): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(dbName, 1);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = (): void => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        const objectStore = db.createObjectStore(storeName, { keyPath: 'id' });
        objectStore.createIndex('by-session', 'session', { unique: false });
        objectStore.createIndex('by-ts', 'ts', { unique: false });
      }
    };
    request.onsuccess = (): void => resolve(request.result);
    request.onerror = (): void => resolve(null);
    request.onblocked = (): void => resolve(null);
  });
}

function txPromise(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = (): void => resolve();
    tx.onerror = (): void => reject(tx.error ?? new Error('idb transaction error'));
    tx.onabort = (): void => reject(tx.error ?? new Error('idb transaction aborted'));
  });
}

function reqPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = (): void => resolve(request.result);
    request.onerror = (): void => reject(request.error ?? new Error('idb request error'));
  });
}

/**
 * Build the IndexedDB-backed `QoeStore`. When IndexedDB is missing or
 * the open fails, the store becomes a no-op fallback so analytics
 * never crashes the player.
 */
export function createIndexedDbStore(opts: IndexedDbStoreOptions = {}): QoeStore {
  const dbName = opts.dbName ?? DEFAULT_DB;
  const storeName = opts.storeName ?? DEFAULT_STORE;
  const factory = resolveFactory(opts);

  let dbPromise: Promise<IDBDatabase | null> | null = null;
  const getDb = async (): Promise<IDBDatabase | null> => {
    if (!factory) return null;
    if (!dbPromise) dbPromise = openDb(factory, dbName, storeName);
    return dbPromise;
  };

  return {
    async put(event) {
      const db = await getDb();
      if (!db) return;
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(event);
      try {
        await txPromise(tx);
      } catch {
        // Quota / write failures are non-fatal.
      }
    },

    async query(filter) {
      const db = await getDb();
      if (!db) return [];
      const tx = db.transaction(storeName, 'readonly');
      let all: QoeEventBase[];
      try {
        all = (await reqPromise(tx.objectStore(storeName).getAll())) as QoeEventBase[];
      } catch {
        return [];
      }
      if (!filter) return all;
      return all.filter((e) => matchesFilter(e, filter));
    },

    async drop(ids) {
      const db = await getDb();
      if (!db) return;
      const tx = db.transaction(storeName, 'readwrite');
      const objectStore = tx.objectStore(storeName);
      for (const id of ids) objectStore.delete(id);
      try {
        await txPromise(tx);
      } catch {
        /* ignored */
      }
    },

    async clear() {
      const db = await getDb();
      if (!db) return;
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
      try {
        await txPromise(tx);
      } catch {
        /* ignored */
      }
    },

    async count(filter: QoeFilter | undefined) {
      const db = await getDb();
      if (!db) return 0;
      const tx = db.transaction(storeName, 'readonly');
      if (!filter) {
        try {
          return (await reqPromise(tx.objectStore(storeName).count())) as number;
        } catch {
          return 0;
        }
      }
      // Post-filter on a full pull. Faster index lookups land in a
      // follow-up release once we have real-world cardinalities.
      let all: QoeEventBase[];
      try {
        all = (await reqPromise(tx.objectStore(storeName).getAll())) as QoeEventBase[];
      } catch {
        return 0;
      }
      return all.filter((e) => matchesFilter(e, filter)).length;
    },
  };
}
