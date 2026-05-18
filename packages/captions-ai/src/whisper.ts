import type { Segment } from './timing-aligner.js';

/**
 * Abstract transcription engine. The default implementation drives
 * Transformers.js (via the optional `@huggingface/transformers` peer dep)
 * inside a Web Worker; unit tests pass a fake engine that returns scripted
 * segments without loading a 39 MB model.
 */
export interface TranscriptionEngine {
  readonly name: string;
  /**
   * Transcribe one window of 16 kHz mono PCM and return its segments. The
   * returned timestamps are relative to the start of the window (0..30);
   * the caller offsets them by the window's `startSeconds`.
   */
  transcribe(pcm: Float32Array, options?: TranscribeOptions): Promise<Segment[]>;
  /** Optional warmup hook — fetch the model and run one zero-length pass. */
  prepare?(): Promise<void>;
  /** Optional teardown — terminate the worker / drop the model. */
  dispose?(): Promise<void>;
}

export interface TranscribeOptions {
  /** ISO language code, or `'auto'` for Whisper's built-in detector. */
  language?: string;
  /** Hard cap on inference time (ms). The engine should resolve with
   *  whatever it has when the limit is hit; default 6000. */
  timeoutMs?: number;
}

/** Quick sanity check: was a 39 MB blob already cached? */
export interface ModelCacheProbe {
  cached(modelId: string): Promise<boolean>;
}

/**
 * Browser Cache API probe. Wrapped behind an interface so it can be stubbed
 * in unit tests; on iOS Safari (where the Cache API is partial) callers
 * can fall back to `false` and re-download on every session.
 */
export function createCacheApiProbe(cacheName = 'bach-captions-models'): ModelCacheProbe {
  return {
    async cached(modelId) {
      if (typeof caches === 'undefined') return false;
      try {
        const cache = await caches.open(cacheName);
        const matches = await cache.keys();
        return matches.some((req) => req.url.includes(modelId));
      } catch {
        return false;
      }
    },
  };
}

/** Default model identifiers, ordered by size / accuracy trade-off. */
export const WHISPER_MODELS = {
  tiny: { id: 'Xenova/whisper-tiny', sizeBytes: 39 * 1024 * 1024, accuracy: 'baseline' },
  base: { id: 'Xenova/whisper-base', sizeBytes: 74 * 1024 * 1024, accuracy: 'better' },
  small: { id: 'Xenova/whisper-small', sizeBytes: 244 * 1024 * 1024, accuracy: 'best' },
} as const;

export type WhisperModelKey = keyof typeof WHISPER_MODELS;
