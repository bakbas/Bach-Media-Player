import { describe, expect, it } from 'vitest';
import { createIndexedDbStore } from './indexeddb.js';

/**
 * Hand-rolled IDB shim. happy-dom doesn't expose IndexedDB, so the
 * store would otherwise be a permanent no-op fallback and we'd never
 * exercise the real `put / query / drop / clear / count` paths. The
 * shim is just expressive enough to cover those branches; it is not
 * meant to be a faithful IDB implementation.
 */

interface IdbRecord {
  id: number;
  [k: string]: unknown;
}

function fakeFactory(): IDBFactory {
  const stores = new Map<string, Map<number, IdbRecord>>();

  function makeRequest<T>(execute: () => T): IDBRequest<T> {
    type Cb = (ev: Event) => void;
    const req = {
      onsuccess: null as Cb | null,
      onerror: null as Cb | null,
    } as unknown as IDBRequest<T> & {
      onsuccess: Cb | null;
      onerror: Cb | null;
    };
    queueMicrotask(() => {
      try {
        (req as unknown as { result: T }).result = execute();
        req.onsuccess?.(new Event('success'));
      } catch (err) {
        (req as unknown as { error: Error }).error = err as Error;
        req.onerror?.(new Event('error'));
      }
    });
    return req;
  }

  function makeTransaction(name: string): IDBTransaction {
    const store = stores.get(name) ?? new Map<number, IdbRecord>();
    stores.set(name, store);
    const objectStore = {
      put: (value: IdbRecord) =>
        makeRequest(() => {
          store.set(value.id, value);
          return value.id;
        }),
      delete: (id: number) =>
        makeRequest(() => {
          store.delete(id);
          return undefined;
        }),
      clear: () =>
        makeRequest(() => {
          store.clear();
          return undefined;
        }),
      getAll: () => makeRequest(() => Array.from(store.values())),
      count: () => makeRequest(() => store.size),
    } as unknown as IDBObjectStore;
    const tx = {
      objectStore: () => objectStore,
      oncomplete: null as ((ev: Event) => void) | null,
    } as unknown as IDBTransaction & { oncomplete: ((ev: Event) => void) | null };
    queueMicrotask(() => tx.oncomplete?.(new Event('complete')));
    return tx;
  }

  return {
    open(name: string): IDBOpenDBRequest {
      const req = {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        onblocked: null,
      } as unknown as IDBOpenDBRequest & {
        onsuccess: ((ev: Event) => void) | null;
        onupgradeneeded: ((ev: Event) => void) | null;
      };
      const db = {
        objectStoreNames: { contains: () => true } as unknown as DOMStringList,
        createObjectStore: () => ({ createIndex: () => ({}) }) as unknown as IDBObjectStore,
        transaction: (n: string) => makeTransaction(typeof n === 'string' ? n : 'events'),
      } as unknown as IDBDatabase;
      void name;
      queueMicrotask(() => {
        (req as unknown as { result: IDBDatabase }).result = db;
        req.onupgradeneeded?.(new Event('upgradeneeded'));
        req.onsuccess?.(new Event('success'));
      });
      return req;
    },
  } as unknown as IDBFactory;
}

const event = (id: number, session = 's', type: 'playing' | 'pause' = 'playing') => ({
  id,
  ts: id * 10,
  session,
  type,
  data: {} as Record<string, never>,
});

describe('createIndexedDbStore — fallback when no factory available', () => {
  it('returns a no-op store when neither global nor injected factory exists', async () => {
    const store = createIndexedDbStore({ indexedDB: undefined });
    await store.put(event(1));
    expect(await store.query()).toEqual([]);
    expect(await store.count()).toBe(0);
  });
});

describe('createIndexedDbStore — happy path against the shim', () => {
  it('puts and queries events', async () => {
    const store = createIndexedDbStore({ indexedDB: fakeFactory() });
    await store.put(event(1));
    await store.put(event(2));
    const all = await store.query();
    expect(all).toHaveLength(2);
  });

  it('filters with a session selector', async () => {
    const store = createIndexedDbStore({ indexedDB: fakeFactory() });
    await store.put(event(1, 'a'));
    await store.put(event(2, 'b'));
    const filtered = await store.query({ session: 'a' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.session).toBe('a');
  });

  it('drops by id', async () => {
    const store = createIndexedDbStore({ indexedDB: fakeFactory() });
    await store.put(event(1));
    await store.put(event(2));
    await store.drop([1]);
    expect(await store.query()).toHaveLength(1);
  });

  it('clears everything', async () => {
    const store = createIndexedDbStore({ indexedDB: fakeFactory() });
    await store.put(event(1));
    await store.clear();
    expect(await store.query()).toEqual([]);
  });

  it('counts with and without a filter', async () => {
    const store = createIndexedDbStore({ indexedDB: fakeFactory() });
    await store.put(event(1, 'a'));
    await store.put(event(2, 'b'));
    expect(await store.count()).toBe(2);
    expect(await store.count({ session: 'a' })).toBe(1);
  });

  it('respects custom dbName and storeName', async () => {
    const store = createIndexedDbStore({
      dbName: 'custom-db',
      storeName: 'custom-events',
      indexedDB: fakeFactory(),
    });
    await store.put(event(1));
    expect(await store.query()).toHaveLength(1);
  });
});

describe('createIndexedDbStore — swallows backend errors silently', () => {
  it('open() throwing degrades to a no-op store', async () => {
    const factory: IDBFactory = {
      open: () => {
        throw new Error('blocked');
      },
    } as unknown as IDBFactory;
    const store = createIndexedDbStore({ indexedDB: factory });
    await store.put(event(1));
    expect(await store.query()).toEqual([]);
    expect(await store.count()).toBe(0);
  });
});
