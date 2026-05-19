import type { DecoderController, EncodedVideoChunkLike } from './decoder.js';
import type { FrameCache } from './frame-cache.js';
import {
  type Frame,
  type KeyframeIndex,
  findFrameAtTime,
  findPrecedingKeyframe,
  gopFor,
  stepFrame,
} from './keyframe-index.js';

/**
 * Stepper API on top of an indexed bytestream. Exposes the only seek
 * primitives we need to expose to the UI:
 *
 *   - `at(time)`         — seek to a precise wall-clock time.
 *   - `step(delta)`      — move N samples (frame-by-frame review).
 *   - `prev()` / `next()` — convenience wrappers for delta = ±1.
 *
 * Every method runs through the same decode-on-demand path:
 *
 *   1. Look up the target frame index (binary search in the keyframe index).
 *   2. Hit the LRU cache; if present, deliver.
 *   3. Find the preceding sync sample, replay the GOP through the decoder,
 *      cache each emitted frame, return the target.
 *
 * The byte payload of an encoded chunk has to come from outside — the
 * caller passes a `fetchSampleBytes(frame)` that fetches or copies the
 * source bytes for a given index sample. The MP4Box-driven implementation
 * lives in `mp4box-source.ts`; tests use a deterministic in-memory source.
 */
export interface FrameStepperOptions {
  index: KeyframeIndex;
  decoder: DecoderController;
  cache: FrameCache<unknown>;
  /** Byte fetcher for one sample. */
  fetchSampleBytes: (frame: Frame) => Promise<Uint8Array> | Uint8Array;
  /** Adapter that turns a Frame + bytes into the chunk shape the decoder needs. */
  toChunk: (frame: Frame, bytes: Uint8Array) => EncodedVideoChunkLike;
  /** Bytes estimate for the value the decoder produces. Optional. */
  estimateBytes?: (frame: Frame) => number;
}

export interface FrameStepper {
  /** Current frame index, or -1 before the first decode. */
  readonly position: number;
  at(time: number): Promise<unknown | null>;
  step(delta: number): Promise<unknown | null>;
  prev(): Promise<unknown | null>;
  next(): Promise<unknown | null>;
}

export function createFrameStepper(opts: FrameStepperOptions): FrameStepper {
  const { index, decoder, cache, fetchSampleBytes, toChunk } = opts;
  const estimate = opts.estimateBytes ?? (() => 4 * 1920 * 1080); // 1080p RGBA fallback

  let position = -1;

  const ensureFrame = async (targetIndex: number): Promise<unknown | null> => {
    if (targetIndex < 0 || targetIndex >= index.frames.length) return null;
    const cached = cache.get(targetIndex);
    if (cached !== null) {
      position = targetIndex;
      return cached;
    }

    const gop = gopFor(index, targetIndex);
    if (gop.length === 0) return null;

    // Reset the decoder so stale in-flight decodes from prior seeks don't
    // collide with this GOP's output.
    decoder.reset();

    // Cache index for the first frame of the GOP — the rest follow by +i.
    const baseIndex = findPrecedingKeyframe(index, gop[0]?.pts ?? targetIndex);

    let result: unknown | null = null;
    for (let i = 0; i < gop.length; i += 1) {
      const frame = gop[i];
      if (!frame) continue;
      const frameIndex = baseIndex + i;
      const bytes = await fetchSampleBytes(frame);
      const chunk = toChunk(frame, bytes);
      const decoded = await decoder.decode(chunk, frame.pts);
      cache.put({
        index: frameIndex,
        bytes: decoded.bytes || estimate(frame),
        value: decoded.value,
        ...(decoded.release ? { release: () => decoded.release?.() } : {}),
      });
      if (i === gop.length - 1) {
        result = decoded.value;
        position = frameIndex;
      }
    }
    return result;
  };

  return {
    get position() {
      return position;
    },

    async at(time) {
      const targetIndex = findFrameAtTime(index, time);
      return ensureFrame(targetIndex);
    },

    async step(delta) {
      if (position < 0) {
        return ensureFrame(Math.max(0, delta));
      }
      return ensureFrame(stepFrame(index, position, delta));
    },

    prev() {
      return this.step(-1);
    },

    next() {
      return this.step(1);
    },
  };
}

/**
 * Fallback stepper for environments without WebCodecs (Safari < 17). Drives
 * the underlying `<video>` element's `currentTime` to the start of each
 * frame and returns when the next `seeked` event fires. Step granularity
 * is dictated by the index — frame-accurate scrubbing requires the same
 * MP4Box index, the difference is which decoder produces the pixels.
 */
export interface VideoLike {
  currentTime: number;
  addEventListener(type: string, handler: (event: Event) => void): void;
  removeEventListener(type: string, handler: (event: Event) => void): void;
}

export interface CurrentTimeFallbackOptions {
  index: KeyframeIndex;
  video: VideoLike;
}

export function createCurrentTimeFallback(opts: CurrentTimeFallbackOptions): FrameStepper {
  let position = -1;

  const seekTo = (targetIndex: number): Promise<null> => {
    if (targetIndex < 0 || targetIndex >= opts.index.frames.length) return Promise.resolve(null);
    const frame = opts.index.frames[targetIndex];
    if (!frame) return Promise.resolve(null);
    return new Promise<null>((resolve) => {
      const handler = (): void => {
        opts.video.removeEventListener('seeked', handler);
        position = targetIndex;
        resolve(null);
      };
      opts.video.addEventListener('seeked', handler);
      opts.video.currentTime = frame.pts;
    });
  };

  return {
    get position() {
      return position;
    },
    async at(time) {
      return seekTo(findFrameAtTime(opts.index, time));
    },
    async step(delta) {
      const target = position < 0 ? Math.max(0, delta) : stepFrame(opts.index, position, delta);
      return seekTo(target);
    },
    prev() {
      return this.step(-1);
    },
    next() {
      return this.step(1);
    },
  };
}
