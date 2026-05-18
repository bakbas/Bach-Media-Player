import type { MediaEngine } from './engine.js';

/**
 * Codec / DRM candidate descriptor. Engines emit these (one per content type they
 * can play) and the negotiator ranks them against the host's MediaCapabilities.
 *
 * Designed to mirror the structure of `MediaCapabilitiesDecodingConfiguration`
 * (subset we actually care about for video MSE / native playback).
 */
export interface PlaybackCandidate {
  /** Container MIME, e.g. `video/mp4; codecs="av01.0.05M.08,opus"`. */
  contentType: string;
  /** Decode width in CSS pixels. */
  width: number;
  /** Decode height in CSS pixels. */
  height: number;
  /** Decode framerate. */
  framerate: number;
  /** Average bitrate in bits per second. */
  bitrate: number;
  /** Optional DRM requirement. When absent, clear-key playback is assumed. */
  keySystem?: 'com.widevine.alpha' | 'com.apple.fps' | 'com.microsoft.playready.recommendation';
}

export interface CodecCapability {
  candidate: PlaybackCandidate;
  /** True when MediaCapabilities reports `supported`. */
  supported: boolean;
  /** True when MediaCapabilities reports `smooth` playback. */
  smooth: boolean;
  /** True when MediaCapabilities reports `powerEfficient` playback. */
  powerEfficient: boolean;
}

/**
 * Subset of the `MediaCapabilities` interface we depend on. Accepting this as
 * an explicit parameter (rather than reaching for `navigator.mediaCapabilities`)
 * makes the negotiator unit-testable without monkey-patching globals.
 */
export interface MediaCapabilitiesLike {
  decodingInfo(config: {
    type: 'media-source' | 'file';
    video?: {
      contentType: string;
      width: number;
      height: number;
      framerate: number;
      bitrate: number;
    };
    keySystemConfiguration?: { keySystem: string };
  }): Promise<{ supported: boolean; smooth: boolean; powerEfficient: boolean }>;
}

const ZERO_CAPABILITY = {
  supported: false,
  smooth: false,
  powerEfficient: false,
} as const;

/** Score a single capability — higher is better. Used by `pickBestCandidate`. */
export function scoreCapability(cap: CodecCapability): number {
  if (!cap.supported) return -1;
  const smooth = cap.smooth ? 2 : 0;
  const efficient = cap.powerEfficient ? 1 : 0;
  return smooth + efficient;
}

/**
 * Probe a single candidate via the host MediaCapabilities API. Falls back to
 * an unsupported capability if the API throws, which lets callers degrade
 * gracefully on browsers that ship the interface but reject specific shapes
 * (older Safari does this for some HEVC configurations).
 */
export async function probeCandidate(
  candidate: PlaybackCandidate,
  mc: MediaCapabilitiesLike,
  type: 'media-source' | 'file' = 'media-source',
): Promise<CodecCapability> {
  try {
    const result = await mc.decodingInfo({
      type,
      video: {
        contentType: candidate.contentType,
        width: candidate.width,
        height: candidate.height,
        framerate: candidate.framerate,
        bitrate: candidate.bitrate,
      },
      ...(candidate.keySystem
        ? { keySystemConfiguration: { keySystem: candidate.keySystem } }
        : {}),
    });
    return { candidate, ...result };
  } catch {
    return { candidate, ...ZERO_CAPABILITY };
  }
}

/**
 * Pick the highest-scoring supported candidate. Returns `null` when none of
 * the candidates are supported — caller should surface an `unsupported` error.
 */
export function pickBestCandidate(
  capabilities: ReadonlyArray<CodecCapability>,
): CodecCapability | null {
  let best: CodecCapability | null = null;
  let bestScore = -1;
  for (const cap of capabilities) {
    const s = scoreCapability(cap);
    if (s > bestScore) {
      bestScore = s;
      best = cap;
    }
  }
  return best?.supported ? best : null;
}

export interface EngineSelection {
  engine: MediaEngine;
  capability: CodecCapability;
}

/**
 * Pick the first engine that can handle `src` (via its own `canHandle`) and
 * has a supported codec/DRM combination. Engines are tried in priority order
 * — typically `[engine-hls, engine-dash, engine-native]` — and a candidate
 * list is consulted per engine. The native engine usually emits a single
 * candidate matching the source's MIME.
 *
 * Returns `null` when no combination works; callers can then raise a typed
 * error event so the UI can show a clear "device cannot play this" message.
 */
export async function selectEngine(opts: {
  src: string;
  mime?: string;
  engines: ReadonlyArray<MediaEngine>;
  candidatesByEngine: ReadonlyMap<string, ReadonlyArray<PlaybackCandidate>>;
  mediaCapabilities: MediaCapabilitiesLike;
}): Promise<EngineSelection | null> {
  for (const engine of opts.engines) {
    const handles = await engine.canHandle(opts.src, opts.mime);
    if (!handles) continue;

    const candidates = opts.candidatesByEngine.get(engine.name) ?? [];
    if (candidates.length === 0) continue;

    const probed = await Promise.all(
      candidates.map((c) => probeCandidate(c, opts.mediaCapabilities)),
    );
    const best = pickBestCandidate(probed);
    if (best) return { engine, capability: best };
  }
  return null;
}
