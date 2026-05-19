import type { FrameStepper } from './frame-stepper.js';
import {
  type Frame,
  type KeyframeIndex,
  findFrameAtTime,
  findPrecedingKeyframe,
} from './keyframe-index.js';

/**
 * Scrub engine — turns pointer hover events on the progress bar into
 * preview frame deliveries. Two strategies are bundled:
 *
 *   - "keyframe-only": pull the preceding keyframe for the hovered time.
 *     Cheapest path; works with the existing GOP-replay flow because
 *     keyframes never need replay. Good default for trailers / short VOD.
 *   - "dense": precompute N evenly spaced thumbnails on warmup() so the
 *     hover loop is a constant-time lookup. Good for editorial timelines
 *     where the user expects the strip to be visible without latency.
 *
 * Both paths share a debounce that drops hover events that arrive faster
 * than the stepper can decode — without this the decoder queue blows up
 * on aggressive scrubbing.
 */
export type ScrubStrategy = 'keyframe-only' | 'dense';

export interface ScrubEngineOptions {
  stepper: FrameStepper;
  index: KeyframeIndex;
  strategy?: ScrubStrategy;
  /** For `dense`: how many thumbnails to spread across the duration. */
  density?: number;
  /** Drop hovers that fire faster than this minimum interval (ms). */
  debounceMs?: number;
  /** Optional clock for tests. Defaults to performance.now if available. */
  now?: () => number;
}

export interface ScrubEngine {
  /** Emit a preview frame for a hovered media time. */
  hover(time: number): Promise<unknown | null>;
  /** Optionally pre-decode dense thumbnails. Resolves once the strip is ready. */
  warmup(): Promise<void>;
  /** Whether the dense strip is fully cached. */
  readonly ready: boolean;
}

const DEFAULT_DENSITY = 32;
const DEFAULT_DEBOUNCE_MS = 16;

function defaultNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/**
 * Build a scrub engine over an existing FrameStepper. The engine never owns
 * the index or the decoder — it borrows them, so its lifetime can be tied
 * to the host UI without affecting playback decoding.
 */
export function createScrubEngine(opts: ScrubEngineOptions): ScrubEngine {
  const strategy: ScrubStrategy = opts.strategy ?? 'keyframe-only';
  const density = Math.max(1, opts.density ?? DEFAULT_DENSITY);
  const debounce = Math.max(0, opts.debounceMs ?? DEFAULT_DEBOUNCE_MS);
  const now = opts.now ?? defaultNow;

  let lastEmit = Number.NEGATIVE_INFINITY;
  let ready = false;

  /**
   * Map an arbitrary hover time to the index of the frame we will actually
   * deliver. For keyframe-only mode that's the preceding sync sample; for
   * dense mode it's the nearest precomputed slot.
   */
  const targetIndexFor = (time: number): number => {
    if (strategy === 'keyframe-only') {
      const idx = findPrecedingKeyframe(opts.index, time);
      return idx >= 0 ? idx : findFrameAtTime(opts.index, time);
    }
    // Dense strategy: pick the closest of the precomputed slot pts values.
    if (opts.index.duration <= 0) return -1;
    const slot = Math.round((time / opts.index.duration) * (density - 1));
    const clamped = Math.max(0, Math.min(density - 1, slot));
    const targetTime = (clamped / Math.max(1, density - 1)) * opts.index.duration;
    return findFrameAtTime(opts.index, targetTime);
  };

  const thumbnailTimes = (): number[] => {
    if (opts.index.duration <= 0) return [];
    const out: number[] = [];
    for (let i = 0; i < density; i += 1) {
      out.push((i / Math.max(1, density - 1)) * opts.index.duration);
    }
    return out;
  };

  return {
    get ready() {
      return ready;
    },

    async hover(time) {
      const t = now();
      if (t - lastEmit < debounce) return null;
      lastEmit = t;
      const target = targetIndexFor(time);
      if (target < 0) return null;
      const frame = opts.index.frames[target];
      if (!frame) return null;
      return opts.stepper.at(frame.pts);
    },

    async warmup() {
      if (strategy !== 'dense') {
        // Keyframe strategy doesn't pre-decode — mark ready immediately so
        // callers can show a loading badge if they want.
        ready = true;
        return;
      }
      for (const time of thumbnailTimes()) {
        // Pull each thumbnail; the underlying frame cache deduplicates so
        // repeated hovers near the same slot are O(1).
        await opts.stepper.at(time);
      }
      ready = true;
    },
  };
}

/**
 * Compute the (`time`, `frameIndex`) pairs a `dense` scrub engine would
 * eventually fill. Exported as a standalone helper so the playground can
 * render a static thumbnail strip without instantiating a stepper.
 */
export function denseThumbnailPlan(
  index: KeyframeIndex,
  density: number,
): Array<{ time: number; frame: Frame | null }> {
  if (index.duration <= 0 || density <= 0) return [];
  const out: Array<{ time: number; frame: Frame | null }> = [];
  for (let i = 0; i < density; i += 1) {
    const time = (i / Math.max(1, density - 1)) * index.duration;
    const idx = findFrameAtTime(index, time);
    out.push({ time, frame: idx >= 0 ? (index.frames[idx] ?? null) : null });
  }
  return out;
}
