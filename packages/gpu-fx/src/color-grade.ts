import type { ColorGradeEffect } from './effects.js';

/**
 * Pure math for the color-grade pass. The shader uses these numbers
 * verbatim — the JS side just packs them into a uniform buffer. Keeping
 * the math here means we can unit-test invariants (identity grade is
 * an identity transform, saturation 0 is true grayscale, etc.) without
 * spinning up WebGPU.
 *
 * Luma weights are BT.709 because every modern HDR / SDR pipeline
 * downstream of us expects Rec. 709. If you need Rec. 601 for legacy
 * footage, override via the host's CSS color-management layer or a
 * LUT pass.
 */

const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;

export interface ColorGradeUniforms {
  /** Multiplicative gain after lift+gamma. */
  exposure: number;
  /** Per-channel additive shift. */
  lift: [number, number, number];
  /** Per-channel gamma exponent. */
  gamma: [number, number, number];
  /** Per-channel multiplicative gain. */
  gain: [number, number, number];
  /** 3x3 saturation matrix, row-major. */
  saturationMatrix: Float32Array;
}

/** Per-channel identity defaults so we can tell what the user set vs. omitted. */
export const COLOR_GRADE_DEFAULTS = {
  exposure: 1,
  lift: [0, 0, 0] as [number, number, number],
  gamma: [1, 1, 1] as [number, number, number],
  gain: [1, 1, 1] as [number, number, number],
  saturation: 1,
};

/**
 * Build the 3x3 saturation matrix for the requested factor. `s = 1`
 * is identity, `s = 0` collapses to BT.709 luma (true grayscale), `s
 * > 1` boosts chroma. Negative values are clamped to 0 because they
 * lead to channel inversion artefacts the colour science does not
 * model well.
 */
export function saturationMatrix(s: number): Float32Array {
  const sat = Number.isFinite(s) ? Math.max(0, s) : 1;
  const inv = 1 - sat;
  // Each output channel = sat * inputChannel + (1 - sat) * luma
  // → row = [sat + inv * lumaWeight_self, inv * lumaWeight_other, inv * lumaWeight_other]
  return new Float32Array([
    sat + inv * LUMA_R,
    inv * LUMA_G,
    inv * LUMA_B,
    inv * LUMA_R,
    sat + inv * LUMA_G,
    inv * LUMA_B,
    inv * LUMA_R,
    inv * LUMA_G,
    sat + inv * LUMA_B,
  ]);
}

/** Pack an `Effect` into the uniform record the GPU pass expects. */
export function colorGradeUniforms(effect: ColorGradeEffect): ColorGradeUniforms {
  const exposure = Number.isFinite(effect.exposure)
    ? (effect.exposure as number)
    : COLOR_GRADE_DEFAULTS.exposure;
  const lift = vec3(effect.lift, COLOR_GRADE_DEFAULTS.lift);
  const gamma = vec3(effect.gamma, COLOR_GRADE_DEFAULTS.gamma).map((g) => Math.max(0.001, g)) as [
    number,
    number,
    number,
  ];
  const gain = vec3(effect.gain, COLOR_GRADE_DEFAULTS.gain);
  const saturation = Number.isFinite(effect.saturation)
    ? (effect.saturation as number)
    : COLOR_GRADE_DEFAULTS.saturation;
  return {
    exposure,
    lift,
    gamma,
    gain,
    saturationMatrix: saturationMatrix(saturation),
  };
}

function vec3(
  source: [number, number, number] | undefined,
  fallback: [number, number, number],
): [number, number, number] {
  if (!source) return [...fallback];
  return [
    Number.isFinite(source[0]) ? source[0] : fallback[0],
    Number.isFinite(source[1]) ? source[1] : fallback[1],
    Number.isFinite(source[2]) ? source[2] : fallback[2],
  ];
}

/**
 * CPU-side reference implementation of the color-grade math. The GPU
 * shader implements the same formula in WGSL; we use this for unit
 * tests and for the fallback canvas pipeline (Phase 4 stretch).
 *
 *   out = clamp01((((in + lift) ^ (1/gamma)) * gain) * exposure)
 *   then mix with luma per saturation
 */
export function applyColorGrade(
  rgba: ArrayLike<number>,
  u: ColorGradeUniforms,
  out: Float32Array,
): Float32Array {
  for (let i = 0; i < rgba.length; i += 4) {
    const r0 = rgba[i] ?? 0;
    const g0 = rgba[i + 1] ?? 0;
    const b0 = rgba[i + 2] ?? 0;
    const a0 = rgba[i + 3] ?? 1;

    const r1 = (r0 + u.lift[0]) ** (1 / u.gamma[0]) * u.gain[0] * u.exposure;
    const g1 = (g0 + u.lift[1]) ** (1 / u.gamma[1]) * u.gain[1] * u.exposure;
    const b1 = (b0 + u.lift[2]) ** (1 / u.gamma[2]) * u.gain[2] * u.exposure;

    const m = u.saturationMatrix;
    const r2 = (m[0] ?? 1) * r1 + (m[1] ?? 0) * g1 + (m[2] ?? 0) * b1;
    const g2 = (m[3] ?? 0) * r1 + (m[4] ?? 1) * g1 + (m[5] ?? 0) * b1;
    const b2 = (m[6] ?? 0) * r1 + (m[7] ?? 0) * g1 + (m[8] ?? 1) * b1;

    out[i] = clamp01(r2);
    out[i + 1] = clamp01(g2);
    out[i + 2] = clamp01(b2);
    out[i + 3] = a0;
  }
  return out;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
