import {
  type MediaEngine,
  type MediaEngineEvents,
  type MediaEngineOptions,
  createEventBus,
} from '@bach/core';

/**
 * Minimal structural type for a Shaka Player instance. We avoid importing
 * shaka-player's full type tree because (a) it's a peer dependency, (b) the
 * surface we actually call is small, and (c) `shaka-player` ships its types
 * in a way that pulls in a lot of incidental DOM declarations we don't need.
 */
export interface ShakaPlayerLike {
  attach(video: HTMLMediaElement): Promise<void>;
  detach(): Promise<void>;
  load(url: string): Promise<void>;
  unload(): Promise<void>;
  destroy(): Promise<void>;
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
  configure?(config: Record<string, unknown>): void;
}

export interface ShakaPlayerConstructor {
  new (): ShakaPlayerLike;
  isBrowserSupported(): boolean;
}

export interface ShakaNamespace {
  Player: ShakaPlayerConstructor;
}

export interface CreateDashEngineOptions {
  /** The shaka-player namespace. Pass `import * as shaka from 'shaka-player'`. */
  shaka: ShakaNamespace;
  /** Optional config forwarded to `player.configure(...)` after construction. */
  playerConfig?: Record<string, unknown>;
}

const DASH_EXTENSION = /\.mpd(\?|$)/i;
const DASH_MIME = /^application\/dash\+xml/i;

interface ShakaErrorPayload {
  detail?: { code?: number; category?: number; data?: unknown[]; message?: string };
}

/**
 * Adapter that lets `<bach-player>` drive Shaka Player. Consumers install
 * shaka-player themselves and pass the namespace in; we keep zero hard
 * imports of shaka-player at runtime.
 */
export function createDashEngine(opts: CreateDashEngineOptions): MediaEngine {
  const { shaka, playerConfig } = opts;
  const bus = createEventBus<MediaEngineEvents>();
  let player: ShakaPlayerLike | null = null;
  let video: HTMLVideoElement | null = null;

  const onLoaded = (): void => {
    bus.emit('ready');
    if (video && Number.isFinite(video.duration)) bus.emit('durationchange', video.duration);
  };

  const onError = (event: Event): void => {
    const payload = event as unknown as ShakaErrorPayload;
    const detail = payload.detail ?? {};
    bus.emit('error', {
      code: detail.code ?? 0,
      message: detail.message ?? `shaka-error/${detail.category ?? 'unknown'}`,
    });
  };

  return {
    name: 'dash',

    async canHandle(src: string, mime?: string): Promise<boolean> {
      if (!shaka.Player.isBrowserSupported()) return false;
      if (mime && DASH_MIME.test(mime)) return true;
      return DASH_EXTENSION.test(src);
    },

    async attach(target: HTMLVideoElement, _options: MediaEngineOptions): Promise<void> {
      video = target;
      player = new shaka.Player();
      if (playerConfig && player.configure) player.configure(playerConfig);
      player.addEventListener('loaded', onLoaded);
      player.addEventListener('error', onError);
      await player.attach(target);
    },

    async load(src: string): Promise<void> {
      if (!player) throw new Error('engine-dash: load() called before attach()');
      await player.load(src);
    },

    async destroy(): Promise<void> {
      if (!player) return;
      player.removeEventListener('loaded', onLoaded);
      player.removeEventListener('error', onError);
      await player.destroy();
      player = null;
      video = null;
      bus.clear();
    },

    on: bus.on,
  };
}
