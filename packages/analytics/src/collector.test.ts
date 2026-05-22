import { describe, expect, it } from 'vitest';
import { attachCollector } from './collector.js';
import { createMemoryStore, createRecorder } from './store.js';

/**
 * Collector tests run against a hand-rolled fake host that exposes just
 * enough of the `BachPlayerElement` surface — the state signals plus a
 * `video` element that emits DOM events — so we can drive every QoE
 * event type without spinning up the real Web Component.
 */

interface Signal<T> {
  value: T;
}

function signal<T>(initial: T): Signal<T> {
  return { value: initial };
}

function makeHost(): {
  host: Parameters<typeof attachCollector>[0]['host'];
  video: HTMLVideoElement;
  setError: (err: { code: number; message: string } | null) => void;
} {
  const video = document.createElement('video');
  const state = {
    src: signal<string>('https://example.test/v.m3u8'),
    duration: signal<number>(120),
    currentTime: signal<number>(0),
    error: signal<{ code: number; message: string } | null>(null),
  };
  const target = document.createElement('div');
  const host = Object.assign(target, {
    state,
    video,
  }) as unknown as Parameters<typeof attachCollector>[0]['host'];
  document.body.appendChild(host);
  return {
    host,
    video,
    setError: (err) => {
      state.error.value = err;
    },
  };
}

describe('attachCollector', () => {
  it('writes session-start on attach and session-end on detach', async () => {
    const store = createMemoryStore();
    const recorder = createRecorder({ store, session: 'sess-1', now: () => 1 });
    const { host } = makeHost();
    const detach = attachCollector({ host, recorder, now: () => 2 });
    // Allow the awaited recorder.record promises to settle.
    await Promise.resolve();
    const types = (await store.query()).map((e) => e.type);
    expect(types).toContain('session-start');
    detach();
    await Promise.resolve();
    const after = (await store.query()).map((e) => e.type);
    expect(after).toContain('session-end');
  });

  it('forwards play, pause, loadstart, loadedmetadata, seeked, ratechange, waiting, error', async () => {
    const store = createMemoryStore();
    const recorder = createRecorder({ store, session: 'sess-2', now: () => 1 });
    const { host, video, setError } = makeHost();
    const detach = attachCollector({ host, recorder });
    await Promise.resolve();

    video.dispatchEvent(new Event('play'));
    video.dispatchEvent(new Event('pause'));
    video.dispatchEvent(new Event('loadstart'));
    video.dispatchEvent(new Event('loadedmetadata'));
    video.dispatchEvent(new Event('seeked'));
    video.dispatchEvent(new Event('ratechange'));
    video.dispatchEvent(new Event('waiting'));
    setError({ code: 4, message: 'fatal' });
    video.dispatchEvent(new Event('error'));

    // ratechange path reads video.playbackRate; happy-dom defaults to 1.
    await new Promise((r) => setTimeout(r, 0));
    const types = (await store.query()).map((e) => e.type);
    expect(types).toEqual(
      expect.arrayContaining([
        'session-start',
        'playing',
        'pause',
        'loadstart',
        'loadedmetadata',
        'seek',
        'ratechange',
        'rebuffer',
        'error',
      ]),
    );

    // Error event with a null error.value should still record (empty data).
    setError(null);
    video.dispatchEvent(new Event('error'));
    await new Promise((r) => setTimeout(r, 0));
    const errs = (await store.query({ type: 'error' })).length;
    expect(errs).toBe(2);

    detach();
  });

  it('records bach:conduct-applied and bach:conduct-rejected with reason', async () => {
    const store = createMemoryStore();
    const recorder = createRecorder({ store, session: 'sess-3' });
    const { host } = makeHost();
    attachCollector({ host, recorder });
    await Promise.resolve();

    host.dispatchEvent(new CustomEvent('bach:conduct-applied'));
    host.dispatchEvent(
      new CustomEvent('bach:conduct-rejected', { detail: { reason: 'bad-signature' } }),
    );
    // Rejected with no detail also lands as an event (empty data).
    host.dispatchEvent(new CustomEvent('bach:conduct-rejected'));
    await new Promise((r) => setTimeout(r, 0));

    const applied = await store.query({ type: 'conduct-applied' });
    const rejected = await store.query({ type: 'conduct-rejected' });
    expect(applied).toHaveLength(1);
    expect(rejected).toHaveLength(2);
    expect(rejected[0]?.data).toEqual({ reason: 'bad-signature' });
  });

  it('detach removes every listener it installed', async () => {
    const store = createMemoryStore();
    const recorder = createRecorder({ store, session: 'sess-4' });
    const { host, video } = makeHost();
    const detach = attachCollector({ host, recorder });
    await Promise.resolve();

    detach();
    await new Promise((r) => setTimeout(r, 0));
    const baseline = (await store.query()).length;

    // Events fired after teardown must not produce new entries.
    video.dispatchEvent(new Event('play'));
    host.dispatchEvent(new CustomEvent('bach:conduct-applied'));
    await new Promise((r) => setTimeout(r, 0));
    expect((await store.query()).length).toBe(baseline);
  });

  it('ratechange short-circuits when there is no video', async () => {
    const store = createMemoryStore();
    const recorder = createRecorder({ store, session: 'sess-5' });
    const { host, video } = makeHost();
    // Detach the video reference after wiring; the handler should
    // resolve `host.video === null` and skip the write.
    attachCollector({ host, recorder });
    await Promise.resolve();
    (host as unknown as { video: HTMLVideoElement | null }).video = null;
    video.dispatchEvent(new Event('ratechange'));
    await new Promise((r) => setTimeout(r, 0));
    const rates = await store.query({ type: 'ratechange' });
    expect(rates).toHaveLength(0);
  });

  it('uses the injected clock when provided', async () => {
    const store = createMemoryStore();
    const recorder = createRecorder({ store, session: 'sess-6', now: () => 9000 });
    const { host } = makeHost();
    let now = 1000;
    attachCollector({ host, recorder, now: () => now });
    await Promise.resolve();
    now = 1500;
    host.dispatchEvent(new CustomEvent('bach:conduct-applied'));
    await new Promise((r) => setTimeout(r, 0));
    const applied = await store.query({ type: 'conduct-applied' });
    expect(applied[0]?.ts).toBe(1500);
  });
});
