import { describe, expect, it, vi } from 'vitest';
import { readPermission, resolvePermission, writePermission } from './permission.js';

function makeStore(initial?: Record<string, string>): {
  store: { getItem(k: string): string | null; setItem(k: string, v: string): void };
  data: Record<string, string>;
} {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    store: {
      getItem: (k) => (k in data ? (data[k] ?? null) : null),
      setItem: (k, v) => {
        data[k] = v;
      },
    },
  };
}

describe('readPermission', () => {
  it('returns unknown when no decision stored', () => {
    const { store } = makeStore();
    expect(readPermission(store)).toBe('unknown');
  });
  it('returns the persisted decision', () => {
    const { store } = makeStore({ 'bach:captions-ai:permission': 'granted' });
    expect(readPermission(store)).toBe('granted');
    const denied = makeStore({ 'bach:captions-ai:permission': 'denied' });
    expect(readPermission(denied.store)).toBe('denied');
  });
  it('coerces unknown values to unknown', () => {
    const { store } = makeStore({ 'bach:captions-ai:permission': 'maybe' });
    expect(readPermission(store)).toBe('unknown');
  });
});

describe('writePermission', () => {
  it('persists the decision', () => {
    const { store, data } = makeStore();
    writePermission('granted', store);
    expect(data['bach:captions-ai:permission']).toBe('granted');
  });
  it('swallows storage exceptions', () => {
    const throwing = {
      getItem: () => null,
      setItem: vi.fn(() => {
        throw new Error('quota');
      }),
    };
    expect(() => writePermission('denied', throwing)).not.toThrow();
  });
});

describe('resolvePermission', () => {
  it('returns cached when the probe finds the model', async () => {
    const { store } = makeStore();
    const r = await resolvePermission('tiny', { cached: async () => true }, store);
    expect(r.state).toBe('cached');
    expect(r.model).toBe('tiny');
    expect(r.sizeMb).toBeGreaterThan(0);
  });
  it('returns the stored decision when not cached', async () => {
    const { store } = makeStore({ 'bach:captions-ai:permission': 'granted' });
    const r = await resolvePermission('tiny', { cached: async () => false }, store);
    expect(r.state).toBe('granted');
  });
  it('returns unknown when no probe and no prior decision', async () => {
    const { store } = makeStore();
    const r = await resolvePermission('tiny', undefined, store);
    expect(r.state).toBe('unknown');
  });
  it('rounds sizeMb up so the prompt does not understate', async () => {
    const { store } = makeStore();
    const r = await resolvePermission('tiny', undefined, store);
    expect(r.sizeMb).toBe(39);
  });
});
