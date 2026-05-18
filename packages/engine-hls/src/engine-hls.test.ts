import { describe, expect, it, vi } from 'vitest';
import { type HlsConstructor, type HlsLike, createHlsEngine } from './index.js';

interface FakeHlsInstance extends HlsLike {
  emit(event: string, data?: unknown): void;
  destroyed: boolean;
  media: HTMLMediaElement | null;
  source: string | null;
}

function makeFakeHls(opts: { supported?: boolean } = {}): {
  Hls: HlsConstructor;
  lastInstance: () => FakeHlsInstance | null;
} {
  let instance: FakeHlsInstance | null = null;

  class FakeHls implements HlsLike {
    static isSupported(): boolean {
      return opts.supported ?? true;
    }
    static readonly Events = {
      MANIFEST_PARSED: 'hlsManifestParsed',
      LEVEL_LOADED: 'hlsLevelLoaded',
      ERROR: 'hlsError',
    } as const;

    listeners = new Map<string, Set<(event: string, data: unknown) => void>>();
    media: HTMLMediaElement | null = null;
    source: string | null = null;
    destroyed = false;

    constructor(_config?: Record<string, unknown>) {
      instance = this as unknown as FakeHlsInstance;
    }
    loadSource(url: string): void {
      this.source = url;
    }
    attachMedia(media: HTMLMediaElement): void {
      this.media = media;
    }
    detachMedia(): void {
      this.media = null;
    }
    destroy(): void {
      this.destroyed = true;
    }
    on(event: string, listener: (event: string, data: unknown) => void): void {
      let set = this.listeners.get(event);
      if (!set) {
        set = new Set();
        this.listeners.set(event, set);
      }
      set.add(listener);
    }
    off(event: string, listener: (event: string, data: unknown) => void): void {
      this.listeners.get(event)?.delete(listener);
    }
    emit(event: string, data?: unknown): void {
      for (const listener of this.listeners.get(event) ?? []) listener(event, data);
    }
  }

  return {
    Hls: FakeHls as unknown as HlsConstructor,
    lastInstance: () => instance,
  };
}

describe('createHlsEngine.canHandle', () => {
  it('accepts .m3u8 when Hls.isSupported() is true', async () => {
    const { Hls } = makeFakeHls({ supported: true });
    const engine = createHlsEngine({ Hls });
    expect(await engine.canHandle('stream.m3u8')).toBe(true);
    expect(await engine.canHandle('stream.m3u8?token=abc')).toBe(true);
  });

  it('rejects when Hls.isSupported() is false (e.g. Safari/iOS)', async () => {
    const { Hls } = makeFakeHls({ supported: false });
    const engine = createHlsEngine({ Hls });
    expect(await engine.canHandle('stream.m3u8')).toBe(false);
  });

  it('rejects non-HLS sources', async () => {
    const { Hls } = makeFakeHls({ supported: true });
    const engine = createHlsEngine({ Hls });
    expect(await engine.canHandle('video.mp4')).toBe(false);
    expect(await engine.canHandle('video.mpd')).toBe(false);
  });
});

describe('createHlsEngine attach/load/destroy', () => {
  function video(): HTMLVideoElement {
    return document.createElement('video');
  }

  it('attaches the media and loads the source via hls.js', async () => {
    const { Hls, lastInstance } = makeFakeHls();
    const engine = createHlsEngine({ Hls });
    const v = video();
    await engine.attach(v, {});
    await engine.load('stream.m3u8');
    const i = lastInstance();
    expect(i?.media).toBe(v);
    expect(i?.source).toBe('stream.m3u8');
  });

  it('emits ready on MANIFEST_PARSED', async () => {
    const { Hls, lastInstance } = makeFakeHls();
    const engine = createHlsEngine({ Hls });
    const onReady = vi.fn();
    engine.on('ready', onReady);
    await engine.attach(video(), {});
    lastInstance()?.emit('hlsManifestParsed');
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('emits durationchange on LEVEL_LOADED when duration is finite', async () => {
    const { Hls, lastInstance } = makeFakeHls();
    const engine = createHlsEngine({ Hls });
    const onDuration = vi.fn();
    engine.on('durationchange', onDuration);
    const v = video();
    Object.defineProperty(v, 'duration', { value: 42, configurable: true });
    await engine.attach(v, {});
    lastInstance()?.emit('hlsLevelLoaded');
    expect(onDuration).toHaveBeenCalledWith(42);
  });

  it('emits error only for fatal hls.js errors', async () => {
    const { Hls, lastInstance } = makeFakeHls();
    const engine = createHlsEngine({ Hls });
    const onError = vi.fn();
    engine.on('error', onError);
    await engine.attach(video(), {});
    lastInstance()?.emit('hlsError', {
      type: 'mediaError',
      details: 'bufferStalled',
      fatal: false,
    });
    expect(onError).not.toHaveBeenCalled();
    lastInstance()?.emit('hlsError', {
      type: 'networkError',
      details: 'fragLoadError',
      fatal: true,
      reason: '404',
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0].message).toContain('networkError/fragLoadError');
    expect(onError.mock.calls[0]?.[0].message).toContain('404');
  });

  it('destroys the hls.js instance and clears references', async () => {
    const { Hls, lastInstance } = makeFakeHls();
    const engine = createHlsEngine({ Hls });
    await engine.attach(video(), {});
    await engine.destroy();
    expect(lastInstance()?.destroyed).toBe(true);
  });

  it('load() before attach() rejects', async () => {
    const { Hls } = makeFakeHls();
    const engine = createHlsEngine({ Hls });
    await expect(engine.load('stream.m3u8')).rejects.toThrow(/before attach/);
  });
});
