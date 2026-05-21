import { describe, expect, it } from 'vitest';
import {
  type Thumbnail,
  computeHistogram,
  detectScenes,
  histogramDistance,
} from './scene-detect.js';

function solidColor(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = 255;
  }
  return pixels;
}

function thumb(time: number, color: [number, number, number]): Thumbnail {
  const [r, g, b] = color;
  return { data: solidColor(4, 4, r, g, b), width: 4, height: 4, time };
}

describe('computeHistogram', () => {
  it('puts every pixel of a solid color into one bucket', () => {
    const hist = computeHistogram(solidColor(2, 2, 250, 10, 10), { bins: 4 });
    const populated = hist.filter((v) => v > 0);
    expect(populated).toHaveLength(1);
    expect(populated[0]).toBeCloseTo(1);
  });

  it('normalises to sum 1 for a non-empty buffer', () => {
    const hist = computeHistogram(solidColor(8, 8, 120, 130, 140), { bins: 4 });
    const total = hist.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1);
  });

  it('returns a zero histogram for empty input', () => {
    const hist = computeHistogram(new Uint8ClampedArray(0), { bins: 2 });
    expect(hist).toHaveLength(8);
    expect(hist.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('respects the bins option', () => {
    const hist = computeHistogram(solidColor(1, 1, 0, 0, 0), { bins: 2 });
    expect(hist).toHaveLength(8);
  });
});

describe('histogramDistance', () => {
  it('is zero for identical histograms', () => {
    const hist = computeHistogram(solidColor(4, 4, 50, 100, 150));
    expect(histogramDistance(hist, hist)).toBeCloseTo(0);
  });

  it('is one for fully disjoint histograms', () => {
    const a = computeHistogram(solidColor(4, 4, 250, 0, 0));
    const b = computeHistogram(solidColor(4, 4, 0, 0, 250));
    expect(histogramDistance(a, b)).toBeCloseTo(1);
  });

  it('treats mismatched lengths as fully different', () => {
    const a = computeHistogram(solidColor(2, 2, 10, 10, 10), { bins: 2 });
    const b = computeHistogram(solidColor(2, 2, 10, 10, 10), { bins: 4 });
    expect(histogramDistance(a, b)).toBe(1);
  });
});

describe('detectScenes', () => {
  it('returns no boundaries for a constant strip', () => {
    const strip: Thumbnail[] = Array.from({ length: 6 }, (_, i) => thumb(i, [120, 130, 140]));
    expect(detectScenes(strip)).toEqual([]);
  });

  it('flags a hard cut at the right index', () => {
    const strip: Thumbnail[] = [
      thumb(0, [240, 10, 10]),
      thumb(1, [240, 10, 10]),
      thumb(2, [240, 10, 10]),
      thumb(3, [10, 10, 240]),
      thumb(4, [10, 10, 240]),
    ];
    const cuts = detectScenes(strip);
    expect(cuts).toHaveLength(1);
    expect(cuts[0]?.index).toBe(3);
    expect(cuts[0]?.time).toBe(3);
    expect(cuts[0]?.distance).toBeGreaterThan(0.5);
  });

  it('honours an elevated threshold', () => {
    const strip: Thumbnail[] = [
      thumb(0, [100, 100, 100]),
      // small RGB shift that lands in the same coarse bucket — sub-threshold cut.
      thumb(1, [110, 105, 102]),
    ];
    expect(detectScenes(strip, { threshold: 0.9 })).toEqual([]);
  });

  it('applies minGap to skip near-duplicate boundaries', () => {
    const strip: Thumbnail[] = [
      thumb(0, [240, 10, 10]),
      thumb(1, [10, 240, 10]),
      thumb(2, [10, 10, 240]),
      thumb(3, [240, 240, 10]),
      thumb(4, [240, 240, 10]),
    ];
    const all = detectScenes(strip, { minGap: 1 });
    const sparse = detectScenes(strip, { minGap: 3 });
    expect(all.length).toBeGreaterThan(sparse.length);
    expect(sparse[0]?.index).toBe(1);
  });

  it('returns [] for empty or single-frame inputs', () => {
    expect(detectScenes([])).toEqual([]);
    expect(detectScenes([thumb(0, [0, 0, 0])])).toEqual([]);
  });
});
