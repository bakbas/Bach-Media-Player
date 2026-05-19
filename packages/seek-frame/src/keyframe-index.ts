/**
 * Frame index built from an MP4 / fMP4 trak. Each entry corresponds to one
 * encoded video sample; the `sync` bit tells the decoder which samples are
 * keyframes (SAPs that allow seeking without preceding context).
 *
 * MP4Box.js exposes a per-trak sample table that we coerce into this shape;
 * the rest of the seek-frame machinery only depends on `Frame` and
 * `KeyframeIndex`, never on MP4Box itself. That keeps the parser pluggable
 * and makes the index easy to unit-test with hand-rolled tables.
 */
export interface Frame {
  /** Decode timestamp in seconds. */
  dts: number;
  /** Presentation timestamp in seconds (cts + dts). */
  pts: number;
  /** Duration of the sample in seconds. */
  duration: number;
  /** Whether this is a sync sample (IDR-equivalent). */
  sync: boolean;
  /** Byte offset of the sample in the source bytestream. */
  offset: number;
  /** Sample size in bytes. */
  size: number;
}

export interface KeyframeIndex {
  /** Every sample, sorted by `pts`. */
  readonly frames: ReadonlyArray<Frame>;
  /** Indices into `frames` of sync samples. */
  readonly keyframeIndices: ReadonlyArray<number>;
  /** Total duration covered by the index (seconds). */
  readonly duration: number;
}

/**
 * Build a keyframe index from a flat sample list. The constructor sorts the
 * samples by pts so callers can hand in MP4Box's per-trak table verbatim
 * without worrying about edit lists rearranging order. Duplicate timestamps
 * are kept as separate frames (some codecs emit B-frames with the same pts
 * as an adjacent P-frame).
 */
export function createKeyframeIndex(samples: ReadonlyArray<Frame>): KeyframeIndex {
  const frames = [...samples].sort((a, b) => a.pts - b.pts);
  const keyframeIndices: number[] = [];
  let duration = 0;
  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i];
    if (!frame) continue;
    if (frame.sync) keyframeIndices.push(i);
    const end = frame.pts + frame.duration;
    if (end > duration) duration = end;
  }
  return { frames, keyframeIndices, duration };
}

/**
 * Find the index of the frame whose presentation window contains `time`.
 * Returns `-1` when the time falls outside the index. Binary search — fine
 * for the ~10⁵-sample tables a 2-hour movie produces.
 */
export function findFrameAtTime(index: KeyframeIndex, time: number): number {
  const frames = index.frames;
  if (frames.length === 0) return -1;
  let lo = 0;
  let hi = frames.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const f = frames[mid];
    if (!f) return -1;
    if (time < f.pts) hi = mid - 1;
    else if (time >= f.pts + f.duration) lo = mid + 1;
    else return mid;
  }
  // Allow the final frame to absorb a slightly-overshooting `time` so
  // currentTime === duration still resolves to the last frame.
  const last = frames.length - 1;
  const lastFrame = frames[last];
  if (lastFrame && Math.abs(time - (lastFrame.pts + lastFrame.duration)) < 1e-6) return last;
  return -1;
}

/**
 * Find the nearest sync sample at or before `time`. Returns `-1` when the
 * index contains no keyframes (defensive — every valid MP4 begins with one).
 */
export function findPrecedingKeyframe(index: KeyframeIndex, time: number): number {
  const { keyframeIndices, frames } = index;
  if (keyframeIndices.length === 0) return -1;
  let lo = 0;
  let hi = keyframeIndices.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const frameIdx = keyframeIndices[mid];
    if (frameIdx === undefined) break;
    const frame = frames[frameIdx];
    if (!frame) break;
    if (frame.pts <= time) {
      best = frameIdx;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

/** Step `delta` frames from `from`, clamped to the index range. */
export function stepFrame(index: KeyframeIndex, from: number, delta: number): number {
  if (index.frames.length === 0) return -1;
  const next = from + delta;
  if (next < 0) return 0;
  if (next >= index.frames.length) return index.frames.length - 1;
  return next;
}

/**
 * Return a slice of the index that decodes contiguously from a keyframe up
 * to and including the target frame — the bytes a decoder needs to feed
 * before it can emit `targetIndex`.
 */
export function gopFor(index: KeyframeIndex, targetIndex: number): ReadonlyArray<Frame> {
  if (targetIndex < 0 || targetIndex >= index.frames.length) return [];
  const target = index.frames[targetIndex];
  if (!target) return [];
  const keyframeIdx = findPrecedingKeyframe(index, target.pts);
  if (keyframeIdx < 0 || keyframeIdx > targetIndex) return [];
  return index.frames.slice(keyframeIdx, targetIndex + 1);
}
