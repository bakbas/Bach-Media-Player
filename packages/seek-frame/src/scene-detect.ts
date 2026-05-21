/**
 * Scene-boundary heuristic for the dense scrub thumbnail strip. We bucket
 * each thumbnail's pixels into an RGB histogram, then walk the strip in
 * order and flag any pair of adjacent thumbnails whose L1 histogram
 * distance crosses the threshold. The result is the seek-preview overlay's
 * tick list — viewers see a vertical mark on the timeline where the camera
 * cuts, so dragging the scrubber lands on the right beat without watching
 * every frame in between.
 *
 * Why histogram + L1 instead of an ML model:
 *   - Runs on the existing `dense` thumbnail strip — no extra decode work.
 *   - Deterministic, ~1 KB of code, no model download.
 *   - Bounded distance in [0, 1]; a single threshold tunes recall.
 *   - Catches hard cuts reliably; soft transitions (fades, slow pans) stay
 *     below the threshold by design — they belong in the 1.1 ML model.
 */

/** Normalised RGB histogram. Sum of all entries is 1. */
export type Histogram = ReadonlyArray<number>;

export interface Thumbnail {
  /** RGBA pixels in row-major order. Length must equal width * height * 4. */
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  /** Media time of this thumbnail in seconds. */
  readonly time: number;
}

export interface SceneBoundary {
  /** Index of the thumbnail where the new scene starts. */
  readonly index: number;
  /** Media time of that thumbnail in seconds. */
  readonly time: number;
  /** L1 distance from the previous thumbnail's histogram, in [0, 1]. */
  readonly distance: number;
}

export interface HistogramOptions {
  /** Bins per channel. Total buckets = bins^3. Defaults to 4 (64 buckets). */
  readonly bins?: number;
}

export interface DetectScenesOptions {
  /** Distance threshold above which a cut is flagged. Defaults to 0.35. */
  readonly threshold?: number;
  /** Minimum gap (in thumbnail indices) between two reported boundaries. */
  readonly minGap?: number;
  /** Histogram bins per channel. Defaults to 4. */
  readonly bins?: number;
}

const DEFAULT_BINS = 4;
const DEFAULT_THRESHOLD = 0.35;
const DEFAULT_MIN_GAP = 1;

/**
 * Build an RGB histogram from an RGBA byte buffer. Alpha is ignored so a
 * checkerboard transparency pattern doesn't show up as a fake scene cut.
 * The returned array has `bins^3` entries normalised to sum to 1; an empty
 * input yields a uniform zero histogram so distance math stays defined.
 */
export function computeHistogram(
  pixels: Uint8ClampedArray,
  opts: HistogramOptions = {},
): Histogram {
  const bins = Math.max(1, Math.floor(opts.bins ?? DEFAULT_BINS));
  const total = bins * bins * bins;
  const buckets = new Array<number>(total).fill(0);
  if (pixels.length < 4) return buckets;

  const shift = Math.ceil(Math.log2(256 / bins));
  let count = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const r = (pixels[i] ?? 0) >> shift;
    const g = (pixels[i + 1] ?? 0) >> shift;
    const b = (pixels[i + 2] ?? 0) >> shift;
    // Clamp in case 256 is exactly representable (e.g. bins=1).
    const ri = Math.min(bins - 1, r);
    const gi = Math.min(bins - 1, g);
    const bi = Math.min(bins - 1, b);
    const bucket = (ri * bins + gi) * bins + bi;
    buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    count += 1;
  }

  if (count === 0) return buckets;
  for (let i = 0; i < total; i += 1) {
    buckets[i] = (buckets[i] ?? 0) / count;
  }
  return buckets;
}

/**
 * L1 (Manhattan) distance between two histograms, halved so the result
 * stays in [0, 1]. Two identical histograms give 0; two disjoint histograms
 * (no shared bucket) give 1. Mismatched lengths return 1 — that case only
 * happens when the caller mixed bin counts, which we treat as "fully
 * different" rather than throwing.
 */
export function histogramDistance(a: Histogram, b: Histogram): number {
  if (a.length === 0 || a.length !== b.length) return a.length === 0 && b.length === 0 ? 0 : 1;
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  }
  return Math.min(1, sum / 2);
}

/**
 * Walk an ordered list of thumbnails and report every adjacent transition
 * whose histogram distance exceeds `threshold`. The first thumbnail is
 * never reported — boundaries start at the moment the picture changes,
 * not at t=0.
 *
 * `minGap` lets the caller drop near-duplicate boundaries that fire on
 * consecutive thumbnails (typical of fast cuts inside the same scene like
 * lightning flashes); set it to 0 to keep every crossing.
 */
export function detectScenes(
  thumbs: ReadonlyArray<Thumbnail>,
  opts: DetectScenesOptions = {},
): ReadonlyArray<SceneBoundary> {
  if (thumbs.length < 2) return [];
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const minGap = Math.max(1, Math.floor(opts.minGap ?? DEFAULT_MIN_GAP));
  const bins = opts.bins ?? DEFAULT_BINS;

  let previous = computeHistogram(thumbs[0]?.data ?? new Uint8ClampedArray(0), { bins });
  const boundaries: SceneBoundary[] = [];
  let lastReported = Number.NEGATIVE_INFINITY;

  for (let i = 1; i < thumbs.length; i += 1) {
    const thumb = thumbs[i];
    if (!thumb) continue;
    const current = computeHistogram(thumb.data, { bins });
    const distance = histogramDistance(previous, current);
    if (distance >= threshold && i - lastReported >= minGap) {
      boundaries.push({ index: i, time: thumb.time, distance });
      lastReported = i;
    }
    previous = current;
  }

  return boundaries;
}
