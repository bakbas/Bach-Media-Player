import { describe, expect, it, vi } from 'vitest';
import { createMemoryStore, createRecorder } from './store.js';
import { type UploadTransport, createUploader } from './uploader.js';

function fakeTransport(returns: boolean): UploadTransport & { calls: ReadonlyArray<number>[] } {
  const calls: ReadonlyArray<number>[] = [];
  return {
    calls,
    async send(payload) {
      calls.push(payload.map((e) => e.id));
      return returns;
    },
  };
}

async function seed(store: ReturnType<typeof createMemoryStore>, count: number): Promise<void> {
  const recorder = createRecorder({ store, session: 's' });
  for (let i = 0; i < count; i += 1) {
    await recorder.record({ type: 'playing', session: 's', ts: 1000 + i });
  }
}

describe('createUploader', () => {
  it('refuses to send when consent is denied', async () => {
    const store = createMemoryStore();
    await seed(store, 3);
    const transport = fakeTransport(true);
    const uploader = createUploader({ store, transport, getConsent: () => false });
    expect(await uploader.flush()).toBe(0);
    expect(transport.calls).toHaveLength(0);
    expect((await store.query()).length).toBe(3);
  });

  it('sends a batch then drops it from the store', async () => {
    const store = createMemoryStore();
    await seed(store, 3);
    const transport = fakeTransport(true);
    const uploader = createUploader({ store, transport, getConsent: () => true });
    expect(await uploader.flush()).toBe(3);
    expect(transport.calls[0]).toEqual([1, 2, 3]);
    expect((await store.query()).length).toBe(0);
  });

  it('keeps the batch when the transport fails', async () => {
    const store = createMemoryStore();
    await seed(store, 2);
    const transport = fakeTransport(false);
    const uploader = createUploader({ store, transport, getConsent: () => true });
    expect(await uploader.flush()).toBe(0);
    expect((await store.query()).length).toBe(2);
  });

  it('respects batchSize', async () => {
    const store = createMemoryStore();
    await seed(store, 5);
    const transport = fakeTransport(true);
    const uploader = createUploader({
      store,
      transport,
      getConsent: () => true,
      batchSize: 2,
    });
    expect(await uploader.flush()).toBe(2);
    expect(transport.calls[0]).toEqual([1, 2]);
    expect((await store.query()).length).toBe(3);
  });

  it('drain pulls until the store empties', async () => {
    const store = createMemoryStore();
    await seed(store, 5);
    const transport = fakeTransport(true);
    const uploader = createUploader({
      store,
      transport,
      getConsent: () => true,
      batchSize: 2,
    });
    expect(await uploader.drain()).toBe(5);
    expect((await store.query()).length).toBe(0);
    expect(transport.calls).toHaveLength(3);
  });

  it('drain re-checks consent between batches', async () => {
    const store = createMemoryStore();
    await seed(store, 5);
    const consents = [true, false];
    const consent = (): boolean => consents.shift() ?? false;
    const transport = fakeTransport(true);
    const uploader = createUploader({
      store,
      transport,
      getConsent: consent,
      batchSize: 2,
    });
    const sent = await uploader.drain();
    expect(sent).toBe(2);
    // 3 events remain because consent was withdrawn before the second batch.
    expect((await store.query()).length).toBe(3);
  });

  it('returns 0 from flush when the store is empty', async () => {
    const store = createMemoryStore();
    const transport = fakeTransport(true);
    const uploader = createUploader({ store, transport, getConsent: () => true });
    expect(await uploader.flush()).toBe(0);
    expect(transport.calls).toHaveLength(0);
  });
});

describe('createFetchTransport', () => {
  it('returns false when fetch throws', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof globalThis.fetch;
    const { createFetchTransport } = await import('./uploader.js');
    const transport = createFetchTransport('https://example.com/qoe');
    expect(await transport.send([])).toBe(false);
    globalThis.fetch = original;
  });

  it('returns the ok flag from the response', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(
      async () => new Response(null, { status: 200 }),
    ) as unknown as typeof globalThis.fetch;
    const { createFetchTransport } = await import('./uploader.js');
    const transport = createFetchTransport('https://example.com/qoe');
    expect(await transport.send([])).toBe(true);
    globalThis.fetch = original;
  });
});
