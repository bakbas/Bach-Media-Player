import { describe, expect, it } from 'vitest';
import { createMemoryStore, createRecorder } from './store.js';

describe('createMemoryStore', () => {
  it('puts and queries events', async () => {
    const store = createMemoryStore();
    await store.put({ id: 1, ts: 10, session: 's', type: 'playing', data: {} });
    await store.put({ id: 2, ts: 20, session: 's', type: 'pause', data: {} });
    expect((await store.query()).length).toBe(2);
  });

  it('drops by id', async () => {
    const store = createMemoryStore();
    await store.put({ id: 1, ts: 10, session: 's', type: 'playing', data: {} });
    await store.put({ id: 2, ts: 20, session: 's', type: 'pause', data: {} });
    await store.drop([1]);
    const remaining = await store.query();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(2);
  });

  it('clears everything', async () => {
    const store = createMemoryStore();
    await store.put({ id: 1, ts: 10, session: 's', type: 'playing', data: {} });
    await store.clear();
    expect(await store.query()).toEqual([]);
  });

  it('counts with and without filter', async () => {
    const store = createMemoryStore();
    await store.put({ id: 1, ts: 10, session: 'a', type: 'playing', data: {} });
    await store.put({ id: 2, ts: 20, session: 'b', type: 'pause', data: {} });
    expect(await store.count()).toBe(2);
    expect(await store.count({ session: 'a' })).toBe(1);
  });
});

describe('createRecorder', () => {
  it('fills id and ts, then writes to the store', async () => {
    const store = createMemoryStore();
    const recorder = createRecorder({ store, session: 'fixed', now: () => 1_700_000_000 });
    const event = await recorder.record({ type: 'playing', session: 'fixed' });
    expect(event.id).toBe(1);
    expect(event.ts).toBe(1_700_000_000);
    expect((await store.query())[0]?.id).toBe(1);
  });

  it('honours an explicit ts when provided', async () => {
    const store = createMemoryStore();
    const recorder = createRecorder({ store, session: 'fixed' });
    const event = await recorder.record({ type: 'pause', session: 'fixed', ts: 999 });
    expect(event.ts).toBe(999);
  });

  it('rejects unknown event types', async () => {
    const store = createMemoryStore();
    const recorder = createRecorder({ store, session: 'fixed' });
    await expect(recorder.record({ type: 'something' as never, session: 'fixed' })).rejects.toThrow(
      /unknown event type/,
    );
  });

  it('generates a session id when none is provided', () => {
    const recorder = createRecorder({ store: createMemoryStore() });
    expect(typeof recorder.session).toBe('string');
    expect(recorder.session.length).toBeGreaterThan(0);
  });
});
