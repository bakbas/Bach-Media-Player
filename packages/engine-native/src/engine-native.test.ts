import { describe, expect, it, vi } from 'vitest';
import { createNativeEngine } from './index.js';

const probe = (table: Record<string, '' | 'maybe' | 'probably'>) => ({
  canPlayType: (type: string) => table[type] ?? '',
});

describe('createNativeEngine.canHandle', () => {
  it('accepts .m3u8 when Safari claims maybe-support for HLS MIME', async () => {
    const engine = createNativeEngine({
      probe: probe({ 'application/vnd.apple.mpegurl': 'maybe' }),
    });
    expect(await engine.canHandle('stream.m3u8')).toBe(true);
  });

  it('accepts the legacy HLS MIME', async () => {
    const engine = createNativeEngine({
      probe: probe({ 'application/x-mpegurl': 'probably' }),
    });
    expect(await engine.canHandle('stream.m3u8?token=abc')).toBe(true);
  });

  it('rejects .m3u8 when canPlayType says nothing', async () => {
    const engine = createNativeEngine({ probe: probe({}) });
    expect(await engine.canHandle('stream.m3u8')).toBe(false);
  });

  it('accepts progressive MP4 when canPlayType allows it', async () => {
    const engine = createNativeEngine({ probe: probe({ 'video/mp4': 'probably' }) });
    expect(await engine.canHandle('clip.mp4')).toBe(true);
  });

  it('rejects unknown extensions', async () => {
    const engine = createNativeEngine({
      probe: probe({
        'video/mp4': 'probably',
        'application/vnd.apple.mpegurl': 'probably',
      }),
    });
    expect(await engine.canHandle('clip.mpd')).toBe(false);
  });
});

describe('createNativeEngine attach/load/destroy', () => {
  function makeVideo(): HTMLVideoElement {
    return document.createElement('video');
  }

  it('sets the src on load and emits ready on loadedmetadata', async () => {
    const engine = createNativeEngine({ probe: probe({ 'video/mp4': 'probably' }) });
    const video = makeVideo();
    const onReady = vi.fn();
    engine.on('ready', onReady);
    await engine.attach(video, {});
    await engine.load('clip.mp4');
    expect(video.getAttribute('src')).toBe('clip.mp4');
    video.dispatchEvent(new Event('loadedmetadata'));
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('emits durationchange with the current duration', async () => {
    const engine = createNativeEngine();
    const video = makeVideo();
    const onDuration = vi.fn();
    engine.on('durationchange', onDuration);
    await engine.attach(video, {});
    Object.defineProperty(video, 'duration', { value: 87, configurable: true });
    video.dispatchEvent(new Event('durationchange'));
    expect(onDuration).toHaveBeenCalledWith(87);
  });

  it('emits error with the underlying MediaError code/message', async () => {
    const engine = createNativeEngine();
    const video = makeVideo();
    const onError = vi.fn();
    engine.on('error', onError);
    await engine.attach(video, {});
    Object.defineProperty(video, 'error', {
      value: { code: 4, message: 'src not supported' },
      configurable: true,
    });
    video.dispatchEvent(new Event('error'));
    expect(onError).toHaveBeenCalledWith({ code: 4, message: 'src not supported' });
  });

  it('removes listeners on destroy', async () => {
    const engine = createNativeEngine();
    const video = makeVideo();
    const onReady = vi.fn();
    engine.on('ready', onReady);
    await engine.attach(video, {});
    await engine.destroy();
    video.dispatchEvent(new Event('loadedmetadata'));
    expect(onReady).not.toHaveBeenCalled();
  });

  it('load() before attach() rejects', async () => {
    const engine = createNativeEngine();
    await expect(engine.load('clip.mp4')).rejects.toThrow(/before attach/);
  });

  it('on() returns an unsubscribe that prevents future delivery', async () => {
    const engine = createNativeEngine();
    const video = makeVideo();
    const onReady = vi.fn();
    const off = engine.on('ready', onReady);
    await engine.attach(video, {});
    off();
    video.dispatchEvent(new Event('loadedmetadata'));
    expect(onReady).not.toHaveBeenCalled();
  });
});
