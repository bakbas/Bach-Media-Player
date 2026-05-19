import { describe, expect, it } from 'vitest';
import {
  type CrossfadeCurve,
  crossfadeAt,
  dbToGain,
  gainToDb,
  sampleCrossfadeCurve,
} from './crossfade.js';

describe('crossfadeAt — equal-power', () => {
  it('endpoints are (1,0) and (0,1)', () => {
    expect(crossfadeAt('equal-power', 0)).toEqual({ gainA: 1, gainB: 0 });
    const end = crossfadeAt('equal-power', 1);
    expect(end.gainA).toBeCloseTo(0, 10);
    expect(end.gainB).toBeCloseTo(1, 10);
  });

  it('total power is constant across the curve (cos² + sin² = 1)', () => {
    for (let i = 0; i <= 20; i += 1) {
      const t = i / 20;
      const { gainA, gainB } = crossfadeAt('equal-power', t);
      const power = gainA * gainA + gainB * gainB;
      expect(power).toBeCloseTo(1, 10);
    }
  });

  it('midpoint sits at sqrt(2)/2 for both sources', () => {
    const { gainA, gainB } = crossfadeAt('equal-power', 0.5);
    expect(gainA).toBeCloseTo(Math.SQRT1_2, 10);
    expect(gainB).toBeCloseTo(Math.SQRT1_2, 10);
  });

  it('clamps NaN and out-of-range progress', () => {
    expect(crossfadeAt('equal-power', Number.NaN)).toEqual({ gainA: 1, gainB: 0 });
    expect(crossfadeAt('equal-power', -1)).toEqual({ gainA: 1, gainB: 0 });
    const beyond = crossfadeAt('equal-power', 2);
    expect(beyond.gainA).toBeCloseTo(0, 10);
    expect(beyond.gainB).toBeCloseTo(1, 10);
  });
});

describe('crossfadeAt — linear', () => {
  it('returns the bare linear ramp', () => {
    expect(crossfadeAt('linear', 0.25)).toEqual({ gainA: 0.75, gainB: 0.25 });
    expect(crossfadeAt('linear', 0.5)).toEqual({ gainA: 0.5, gainB: 0.5 });
  });

  it('dips by ~3 dB at the midpoint (the reason equal-power exists)', () => {
    const { gainA, gainB } = crossfadeAt('linear', 0.5);
    const totalPower = gainA * gainA + gainB * gainB;
    expect(gainToDb(Math.sqrt(totalPower))).toBeCloseTo(-3.01, 1);
  });
});

describe('crossfadeAt — logarithmic', () => {
  it('endpoints clamp to (1,0) and (0,1)', () => {
    expect(crossfadeAt('logarithmic', 0).gainA).toBe(1);
    expect(crossfadeAt('logarithmic', 0).gainB).toBe(0);
    expect(crossfadeAt('logarithmic', 1).gainA).toBe(0);
    expect(crossfadeAt('logarithmic', 1).gainB).toBe(1);
  });

  it('mid-fade gains are between 0 and 1', () => {
    const mid = crossfadeAt('logarithmic', 0.5);
    expect(mid.gainA).toBeGreaterThan(0);
    expect(mid.gainA).toBeLessThan(1);
    expect(mid.gainB).toBeGreaterThan(0);
    expect(mid.gainB).toBeLessThan(1);
  });
});

describe('sampleCrossfadeCurve', () => {
  it('returns equal-length arrays matching the requested sample count', () => {
    const out = sampleCrossfadeCurve('equal-power', 33);
    expect(out.gainA.length).toBe(33);
    expect(out.gainB.length).toBe(33);
  });

  it('preserves the equal-power invariant across every sample', () => {
    const { gainA, gainB } = sampleCrossfadeCurve('equal-power', 64);
    for (let i = 0; i < gainA.length; i += 1) {
      const a = gainA[i] ?? 0;
      const b = gainB[i] ?? 0;
      expect(a * a + b * b).toBeCloseTo(1, 5);
    }
  });

  it('clamps sub-2 sample counts to 2', () => {
    const out = sampleCrossfadeCurve('linear', 0);
    expect(out.gainA.length).toBe(2);
    expect(out.gainB.length).toBe(2);
  });
});

describe('gainToDb / dbToGain', () => {
  it('round-trips finite values', () => {
    for (const gain of [0.1, 0.25, 0.5, Math.SQRT1_2, 1, 2]) {
      const db = gainToDb(gain);
      expect(dbToGain(db)).toBeCloseTo(gain, 5);
    }
  });

  it('handles zero / negative gain as -Infinity dB', () => {
    expect(gainToDb(0)).toBe(Number.NEGATIVE_INFINITY);
    expect(gainToDb(-1)).toBe(Number.NEGATIVE_INFINITY);
  });

  it('-Infinity dB maps back to gain 0', () => {
    expect(dbToGain(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it('0 dB is unity gain', () => {
    expect(dbToGain(0)).toBeCloseTo(1, 10);
    expect(gainToDb(1)).toBeCloseTo(0, 10);
  });

  it('every CrossfadeCurve value produces a finite gainA + gainB at midpoint', () => {
    const curves: CrossfadeCurve[] = ['equal-power', 'linear', 'logarithmic'];
    for (const curve of curves) {
      const { gainA, gainB } = crossfadeAt(curve, 0.5);
      expect(Number.isFinite(gainA)).toBe(true);
      expect(Number.isFinite(gainB)).toBe(true);
    }
  });
});
