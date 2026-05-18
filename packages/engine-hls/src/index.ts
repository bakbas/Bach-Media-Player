import {
  type MediaEngine,
  type MediaEngineEvents,
  type MediaEngineOptions,
  createEventBus,
} from '@bach/core';

/**
 * Minimal structural type for an hls.js instance. We avoid importing hls.js's
 * full type tree because (a) hls.js is a peer dependency — consumers control
 * the version — and (b) the surface we actually use is tiny.
 */
export interface HlsLike {
  loadSource(url: string): void;
  attachMedia(media: HTMLMediaElement): void;
  detachMedia(): void;
  destroy(): void;
  on(event: string, listener: (event: string, data: unknown) => void): void;
  off(event: string, listener: (event: string, data: unknown) => void): void;
}

export interface HlsConstructor {
  new (config?: Record<string, unknown>): HlsLike;
  isSupported(): boolean;
  readonly Events: {
    readonly MANIFEST_PARSED: string;
    readonly LEVEL_LOADED: string;
    readonly ERROR: string;
  };
}

export interface CreateHlsEngineOptions {
  /** The hls.js class. Required — pass `import Hls from 'hls.js'`. */
  Hls: HlsConstructor;
  /** Optional config forwarded to the hls.js constructor. */
  hlsConfig?: Record<string, unknown>;
}

const HLS_EXTENSION = /\.m3u8(\?|$)/i;

interface HlsErrorPayload {
  type?: string;
  details?: string;
  fatal?: boolean;
  reason?: string;
}

/**
 * Adapter that lets `<bach-player>` drive hls.js. Consumers install hls.js
 * themselves (peer dependency) and pass the constructor in so the bundle
 * stays free of hls.js bytes when this engine is not used.
 */
export function createHlsEngine(opts: CreateHlsEngineOptions): MediaEngine {
  const { Hls, hlsConfig } = opts;
  const bus = createEventBus<MediaEngineEvents>();
  let hls: HlsLike | null = null;
  let video: HTMLVideoElement | null = null;

  const handleManifest = (): void => bus.emit('ready');

  const handleLevelLoaded = (): void => {
    if (video && Number.isFinite(video.duration)) bus.emit('durationchange', video.duration);
  };

  const handleError = (_event: string, data: unknown): void => {
    const payload = data as HlsErrorPayload;
    if (!payload?.fatal) return;
    bus.emit('error', {
      code: 0,
      message: `${payload.type ?? 'hls-error'}/${payload.details ?? 'unknown'}${payload.reason ? `: ${payload.reason}` : ''}`,
    });
  };

  return {
    name: 'hls',

    async canHandle(src: string): Promise<boolean> {
      if (!Hls.isSupported()) return false;
      return HLS_EXTENSION.test(src);
    },

    async attach(target: HTMLVideoElement, _options: MediaEngineOptions): Promise<void> {
      video = target;
      hls = new Hls(hlsConfig);
      hls.on(Hls.Events.MANIFEST_PARSED, handleManifest);
      hls.on(Hls.Events.LEVEL_LOADED, handleLevelLoaded);
      hls.on(Hls.Events.ERROR, handleError);
      hls.attachMedia(target);
    },

    async load(src: string): Promise<void> {
      if (!hls) throw new Error('engine-hls: load() called before attach()');
      hls.loadSource(src);
    },

    async destroy(): Promise<void> {
      if (!hls) return;
      hls.off(Hls.Events.MANIFEST_PARSED, handleManifest);
      hls.off(Hls.Events.LEVEL_LOADED, handleLevelLoaded);
      hls.off(Hls.Events.ERROR, handleError);
      hls.detachMedia();
      hls.destroy();
      hls = null;
      video = null;
      bus.clear();
    },

    on: bus.on,
  };
}
