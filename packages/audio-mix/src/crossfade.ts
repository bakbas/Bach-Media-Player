/**
 * Crossfade curve helpers. Pure functions over [0,1]; the runtime
 * mixer reads these when it schedules `setValueCurveAtTime()` on the
 * track gain nodes, but the math is interesting on its own (you can
 * use it for caption fade-in, transition cards, anywhere a smooth
 * fade between two sources is needed).
 *
 * Equal-power crossfade keeps the perceived total loudness constant
 * across the transition: `gainA² + gainB² ≈ 1`. Linear crossfade dips
 * by ~3 dB at the midpoint, which is noticeable as a "hole" in
 * dialogue or sustained music. The default is equal-power.
 */
export type CrossfadeCurve = 'equal-power' | 'linear' | 'logarithmic';

export interface CrossfadePoint {
  /** Gain applied to the outgoing source at this instant. */
  gainA: number;
  /** Gain applied to the incoming source at this instant. */
  gainB: number;
}

const HALF_PI = Math.PI / 2;

function clamp01(t: number): number {
  if (Number.isNaN(t)) return 0;
  if (t < 0) return 0;
  if (t > 1) return 1;
  return t;
}

/**
 * Evaluate a crossfade curve at progress `t` (0 → outgoing only,
 * 1 → incoming only). NaN / out-of-range `t` clamps to [0, 1].
 */
export function crossfadeAt(curve: CrossfadeCurve, t: number): CrossfadePoint {
  const x = clamp01(t);
  switch (curve) {
    case 'equal-power': {
      // cos²(x·π/2) + sin²(x·π/2) = 1 — total power constant.
      return { gainA: Math.cos(x * HALF_PI), gainB: Math.sin(x * HALF_PI) };
    }
    case 'linear': {
      return { gainA: 1 - x, gainB: x };
    }
    case 'logarithmic': {
      // Perceptual log fade — matches dB-linear sliders. Map gain to
      // 0 dB at the endpoints and -60 dB at the far end of the other
      // source's curve. Below -60 dB we clamp to 0 to avoid Infinity.
      const dbA = -60 * x;
      const dbB = -60 * (1 - x);
      return {
        gainA: x >= 1 ? 0 : dbToGain(dbA),
        gainB: x <= 0 ? 0 : dbToGain(dbB),
      };
    }
  }
}

/**
 * Sample a crossfade curve at `samples` evenly spaced points. Useful
 * for `AudioParam.setValueCurveAtTime(...)`, which wants a Float32Array.
 */
export function sampleCrossfadeCurve(
  curve: CrossfadeCurve,
  samples: number,
): { gainA: Float32Array; gainB: Float32Array } {
  const count = Math.max(2, Math.floor(samples));
  const gainA = new Float32Array(count);
  const gainB = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const point = crossfadeAt(curve, t);
    gainA[i] = point.gainA;
    gainB[i] = point.gainB;
  }
  return { gainA, gainB };
}

/** Convert a gain factor to dB. -Infinity for 0; NaN clamps to -Infinity. */
export function gainToDb(gain: number): number {
  if (!Number.isFinite(gain) || gain <= 0) return Number.NEGATIVE_INFINITY;
  return 20 * Math.log10(gain);
}

/** Convert dB to a gain factor. -Infinity → 0. */
export function dbToGain(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return 10 ** (db / 20);
}
