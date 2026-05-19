import { describe, expect, it } from 'vitest';
import {
  type Frame,
  createKeyframeIndex,
  findFrameAtTime,
  findPrecedingKeyframe,
  gopFor,
  stepFrame,
} from './keyframe-index.js';

const f = (pts: number, sync = false, duration = 1 / 30): Frame => ({
  dts: pts,
  pts,
  duration,
  sync,
  offset: 0,
  size: 0,
});

describe('createKeyframeIndex', () => {
  it('sorts by pts and records sync sample positions', () => {
    const index = createKeyframeIndex([f(1, false), f(0, true), f(2, true), f(0.5, false)]);
    expect(index.frames.map((x) => x.pts)).toEqual([0, 0.5, 1, 2]);
    expect(index.keyframeIndices).toEqual([0, 3]);
  });

  it('computes total duration from the final pts + duration', () => {
    const index = createKeyframeIndex([f(0, true, 1), f(1, false, 1), f(2, false, 1)]);
    expect(index.duration).toBe(3);
  });

  it('handles an empty sample list', () => {
    const index = createKeyframeIndex([]);
    expect(index.frames).toHaveLength(0);
    expect(index.duration).toBe(0);
  });
});

describe('findFrameAtTime', () => {
  const samples = [f(0, true, 1), f(1, false, 1), f(2, true, 1)];
  const index = createKeyframeIndex(samples);

  it('returns the frame whose window contains the time', () => {
    expect(findFrameAtTime(index, 0.5)).toBe(0);
    expect(findFrameAtTime(index, 1.2)).toBe(1);
    expect(findFrameAtTime(index, 2.99)).toBe(2);
  });

  it('returns the last frame when time equals total duration', () => {
    expect(findFrameAtTime(index, 3)).toBe(2);
  });

  it('returns -1 outside the index range', () => {
    expect(findFrameAtTime(index, -1)).toBe(-1);
    expect(findFrameAtTime(index, 10)).toBe(-1);
  });

  it('returns -1 on an empty index', () => {
    expect(findFrameAtTime(createKeyframeIndex([]), 0)).toBe(-1);
  });
});

describe('findPrecedingKeyframe', () => {
  // GOP layout: K _ _ K _ _ K _
  const samples = [
    f(0, true),
    f(0.1, false),
    f(0.2, false),
    f(0.3, true),
    f(0.4, false),
    f(0.5, false),
    f(0.6, true),
    f(0.7, false),
  ];
  const index = createKeyframeIndex(samples);

  it('returns the keyframe at or before the target time', () => {
    expect(findPrecedingKeyframe(index, 0)).toBe(0);
    expect(findPrecedingKeyframe(index, 0.25)).toBe(0);
    expect(findPrecedingKeyframe(index, 0.3)).toBe(3);
    expect(findPrecedingKeyframe(index, 0.55)).toBe(3);
    expect(findPrecedingKeyframe(index, 1)).toBe(6);
  });

  it('returns -1 when the index has no keyframes', () => {
    const noSync = createKeyframeIndex([f(0), f(0.5), f(1)]);
    expect(findPrecedingKeyframe(noSync, 0.5)).toBe(-1);
  });
});

describe('stepFrame', () => {
  const index = createKeyframeIndex([f(0, true), f(0.1), f(0.2), f(0.3)]);

  it('moves forward and backward', () => {
    expect(stepFrame(index, 1, 1)).toBe(2);
    expect(stepFrame(index, 2, -1)).toBe(1);
  });
  it('clamps below zero and beyond the last frame', () => {
    expect(stepFrame(index, 0, -5)).toBe(0);
    expect(stepFrame(index, 0, 100)).toBe(3);
  });
});

describe('gopFor', () => {
  const samples = [
    f(0, true), // 0
    f(0.1), // 1
    f(0.2), // 2
    f(0.3, true), // 3
    f(0.4), // 4
    f(0.5), // 5
  ];
  const index = createKeyframeIndex(samples);

  it('returns frames from the preceding keyframe through the target', () => {
    expect(gopFor(index, 2).map((x) => x.pts)).toEqual([0, 0.1, 0.2]);
    expect(gopFor(index, 5).map((x) => x.pts)).toEqual([0.3, 0.4, 0.5]);
  });
  it('returns a single-element slice when the target itself is a keyframe', () => {
    expect(gopFor(index, 3).map((x) => x.pts)).toEqual([0.3]);
  });
  it('returns empty slice for out-of-range indices', () => {
    expect(gopFor(index, -1)).toEqual([]);
    expect(gopFor(index, 999)).toEqual([]);
  });
});
