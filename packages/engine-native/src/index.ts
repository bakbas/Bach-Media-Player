import {
  type MediaEngine,
  type MediaEngineEvents,
  type MediaEngineOptions,
  createEventBus,
} from '@bach/core';

interface CanPlayMedia {
  canPlayType(type: string): '' | 'maybe' | 'probably';
}

const HLS_MIME = 'application/vnd.apple.mpegurl';
const HLS_MIME_LEGACY = 'application/x-mpegurl';
const HLS_EXTENSION = /\.m3u8(\?|$)/i;

function isHlsUrl(src: string): boolean {
  return HLS_EXTENSION.test(src);
}

function isMaybePlayable(probe: CanPlayMedia, type: string): boolean {
  const r = probe.canPlayType(type);
  return r === 'maybe' || r === 'probably';
}

/**
 * Engine that lets `HTMLMediaElement` handle the stream directly. On Safari /
 * iOS this is the right choice for HLS (MSE is unavailable in WKWebView); for
 * progressive MP4 / WebM it is the right choice everywhere. The codec
 * negotiator places this last in the priority list so that hls.js / Shaka
 * win on browsers that support MSE; here we just say "yes" to anything
 * `canPlayType` accepts.
 */
export interface CreateNativeEngineOptions {
  /**
   * Override the canPlayType probe — useful in unit tests, where neither
   * happy-dom nor jsdom emit anything but the empty string for media types.
   * In real apps you should not pass this; the engine reads from the
   * supplied video element.
   */
  probe?: CanPlayMedia;
}

export function createNativeEngine(opts: CreateNativeEngineOptions = {}): MediaEngine {
  const bus = createEventBus<MediaEngineEvents>();
  let video: HTMLVideoElement | null = null;
  let probe: CanPlayMedia | null = opts.probe ?? null;

  const onLoadedMetadata = (): void => bus.emit('ready');
  const onDurationChange = (): void => {
    if (video) bus.emit('durationchange', video.duration);
  };
  const onProgress = (): void => {
    if (!video) return;
    const ranges: Array<[number, number]> = [];
    for (let i = 0; i < video.buffered.length; i += 1) {
      ranges.push([video.buffered.start(i), video.buffered.end(i)]);
    }
    bus.emit('progress', ranges);
  };
  const onError = (): void => {
    const err = video?.error;
    bus.emit('error', {
      code: err?.code ?? 0,
      message: err?.message ?? 'native playback error',
    });
  };

  return {
    name: 'native',

    async canHandle(src: string): Promise<boolean> {
      if (!probe) return isHlsUrl(src);
      if (isHlsUrl(src)) {
        return isMaybePlayable(probe, HLS_MIME) || isMaybePlayable(probe, HLS_MIME_LEGACY);
      }
      if (/\.mp4(\?|$)/i.test(src)) return isMaybePlayable(probe, 'video/mp4');
      if (/\.webm(\?|$)/i.test(src)) return isMaybePlayable(probe, 'video/webm');
      if (/\.ogg(\?|$)/i.test(src) || /\.ogv(\?|$)/i.test(src)) {
        return isMaybePlayable(probe, 'video/ogg');
      }
      return false;
    },

    async attach(target: HTMLVideoElement, _opts: MediaEngineOptions): Promise<void> {
      video = target;
      probe = probe ?? (target as unknown as CanPlayMedia);
      target.addEventListener('loadedmetadata', onLoadedMetadata);
      target.addEventListener('durationchange', onDurationChange);
      target.addEventListener('progress', onProgress);
      target.addEventListener('error', onError);
    },

    async load(src: string): Promise<void> {
      if (!video) throw new Error('engine-native: load() called before attach()');
      video.src = src;
      video.load();
    },

    async destroy(): Promise<void> {
      if (!video) return;
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('error', onError);
      video.removeAttribute('src');
      video.load();
      video = null;
      bus.clear();
    },

    on: bus.on,
  };
}
