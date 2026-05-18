import { describe, expect, it, vi } from 'vitest';
import { type ShakaNamespace, type ShakaPlayerLike, createDashEngine } from './index.js';

interface FakeShakaPlayer extends ShakaPlayerLike {
  emit(type: 'loaded'): void;
  emitError(detail: { code?: number; category?: number; message?: string }): void;
  destroyed: boolean;
  loadedUrl: string | null;
  media: HTMLMediaElement | null;
}

function makeShaka(opts: { supported?: boolean } = {}): {
  shaka: ShakaNamespace;
  lastInstance: () => FakeShakaPlayer | null;
} {
  let instance: FakeShakaPlayer | null = null;

  class FakePlayer implements ShakaPlayerLike {
    static isBrowserSupported(): boolean {
      return opts.supported ?? true;
    }

    listeners = new Map<string, Set<(event: Event) => void>>();
    media: HTMLMediaElement | null = null;
    destroyed = false;
    loadedUrl: string | null = null;

    constructor() {
      instance = this as unknown as FakeShakaPlayer;
    }

    async attach(media: HTMLMediaElement): Promise<void> {
      this.media = media;
    }
    async detach(): Promise<void> {
      this.media = null;
    }
    async load(url: string): Promise<void> {
      this.loadedUrl = url;
    }
    async unload(): Promise<void> {
      this.loadedUrl = null;
    }
    async destroy(): Promise<void> {
      this.destroyed = true;
    }
    addEventListener(type: string, listener: (event: Event) => void): void {
      let set = this.listeners.get(type);
      if (!set) {
        set = new Set();
        this.listeners.set(type, set);
      }
      set.add(listener);
    }
    removeEventListener(type: string, listener: (event: Event) => void): void {
      this.listeners.get(type)?.delete(listener);
    }
    emit(type: 'loaded'): void {
      for (const listener of this.listeners.get(type) ?? []) {
        listener(new Event(type));
      }
    }
    emitError(detail: { code?: number; category?: number; message?: string }): void {
      const event = new Event('error') as Event & {
        detail?: { code?: number; category?: number; message?: string };
      };
      event.detail = detail;
      for (const listener of this.listeners.get('error') ?? []) listener(event);
    }
  }

  return {
    shaka: { Player: FakePlayer as unknown as ShakaNamespace['Player'] },
    lastInstance: () => instance,
  };
}

describe('createDashEngine.canHandle', () => {
  it('accepts .mpd when shaka is supported', async () => {
    const { shaka } = makeShaka();
    const engine = createDashEngine({ shaka });
    expect(await engine.canHandle('stream.mpd')).toBe(true);
    expect(await engine.canHandle('stream.mpd?token=abc')).toBe(true);
  });

  it('accepts dash+xml MIME without an extension hint', async () => {
    const { shaka } = makeShaka();
    const engine = createDashEngine({ shaka });
    expect(await engine.canHandle('https://cdn/stream', 'application/dash+xml')).toBe(true);
  });

  it('rejects when shaka reports unsupported', async () => {
    const { shaka } = makeShaka({ supported: false });
    const engine = createDashEngine({ shaka });
    expect(await engine.canHandle('stream.mpd')).toBe(false);
  });

  it('rejects non-DASH sources', async () => {
    const { shaka } = makeShaka();
    const engine = createDashEngine({ shaka });
    expect(await engine.canHandle('video.mp4')).toBe(false);
    expect(await engine.canHandle('video.m3u8')).toBe(false);
  });
});

describe('createDashEngine attach/load/destroy', () => {
  function video(): HTMLVideoElement {
    return document.createElement('video');
  }

  it('attaches the media and loads the source via shaka', async () => {
    const { shaka, lastInstance } = makeShaka();
    const engine = createDashEngine({ shaka });
    const v = video();
    await engine.attach(v, {});
    await engine.load('stream.mpd');
    expect(lastInstance()?.media).toBe(v);
    expect(lastInstance()?.loadedUrl).toBe('stream.mpd');
  });

  it('emits ready + durationchange on shaka loaded event', async () => {
    const { shaka, lastInstance } = makeShaka();
    const engine = createDashEngine({ shaka });
    const onReady = vi.fn();
    const onDuration = vi.fn();
    engine.on('ready', onReady);
    engine.on('durationchange', onDuration);
    const v = video();
    Object.defineProperty(v, 'duration', { value: 120, configurable: true });
    await engine.attach(v, {});
    lastInstance()?.emit('loaded');
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onDuration).toHaveBeenCalledWith(120);
  });

  it('emits error with the shaka detail message', async () => {
    const { shaka, lastInstance } = makeShaka();
    const engine = createDashEngine({ shaka });
    const onError = vi.fn();
    engine.on('error', onError);
    await engine.attach(video(), {});
    lastInstance()?.emitError({ code: 3016, category: 3, message: 'manifest parse failed' });
    expect(onError).toHaveBeenCalledWith({ code: 3016, message: 'manifest parse failed' });
  });

  it('destroys the shaka instance', async () => {
    const { shaka, lastInstance } = makeShaka();
    const engine = createDashEngine({ shaka });
    await engine.attach(video(), {});
    await engine.destroy();
    expect(lastInstance()?.destroyed).toBe(true);
  });

  it('load() before attach() rejects', async () => {
    const { shaka } = makeShaka();
    const engine = createDashEngine({ shaka });
    await expect(engine.load('stream.mpd')).rejects.toThrow(/before attach/);
  });
});
