import { describe, expect, it } from 'vitest';
import {
  COLOR_GRADE_DEFAULTS,
  applyColorGrade,
  colorGradeUniforms,
  saturationMatrix,
} from './color-grade.js';

describe('saturationMatrix', () => {
  it('identity at s=1', () => {
    const m = saturationMatrix(1);
    expect(Array.from(m)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('full luma (BT.709) at s=0', () => {
    const m = saturationMatrix(0);
    // Every row is the BT.709 luma weights.
    const [lr, lg, lb] = [0.2126, 0.7152, 0.0722] as const;
    expect(m[0]).toBeCloseTo(lr, 6);
    expect(m[1]).toBeCloseTo(lg, 6);
    expect(m[2]).toBeCloseTo(lb, 6);
    expect(m[3]).toBeCloseTo(lr, 6);
    expect(m[4]).toBeCloseTo(lg, 6);
  });

  it('clamps negative saturation to 0 (grayscale, no inversion)', () => {
    const m = saturationMatrix(-2);
    expect(m[0]).toBeCloseTo(0.2126, 6);
  });

  it('treats NaN as identity', () => {
    const m = saturationMatrix(Number.NaN);
    expect(m[0]).toBe(1);
    expect(m[1]).toBe(0);
  });
});

describe('colorGradeUniforms', () => {
  it('fills defaults for omitted fields', () => {
    const u = colorGradeUniforms({ type: 'color-grade' });
    expect(u.exposure).toBe(COLOR_GRADE_DEFAULTS.exposure);
    expect(u.lift).toEqual(COLOR_GRADE_DEFAULTS.lift);
    expect(u.gamma).toEqual(COLOR_GRADE_DEFAULTS.gamma);
    expect(u.gain).toEqual(COLOR_GRADE_DEFAULTS.gain);
    expect(u.saturationMatrix.length).toBe(9);
  });

  it('floors gamma to 0.001 to avoid division blow-up in the shader', () => {
    const u = colorGradeUniforms({ type: 'color-grade', gamma: [0, -1, 0.5] });
    expect(u.gamma[0]).toBe(0.001);
    expect(u.gamma[1]).toBe(0.001);
    expect(u.gamma[2]).toBeCloseTo(0.5, 6);
  });

  it('replaces non-finite scalars with the default', () => {
    const u = colorGradeUniforms({
      type: 'color-grade',
      exposure: Number.NaN,
      saturation: Number.POSITIVE_INFINITY,
    });
    expect(u.exposure).toBe(1);
    // Infinity → saturation falls back to 1 → identity matrix.
    expect(u.saturationMatrix[0]).toBe(1);
  });
});

describe('applyColorGrade — CPU reference', () => {
  const identity = colorGradeUniforms({ type: 'color-grade' });

  it('identity preserves rgb and alpha', () => {
    const input = new Float32Array([0.2, 0.5, 0.9, 1, 0, 1, 0, 0.5]);
    const out = new Float32Array(input.length);
    applyColorGrade(input, identity, out);
    expect(out[0]).toBeCloseTo(0.2, 6);
    expect(out[1]).toBeCloseTo(0.5, 6);
    expect(out[2]).toBeCloseTo(0.9, 6);
    expect(out[3]).toBe(1);
    expect(out[7]).toBe(0.5);
  });

  it('exposure 2 doubles the channels (clamped at 1)', () => {
    const u = colorGradeUniforms({ type: 'color-grade', exposure: 2 });
    const out = new Float32Array(4);
    applyColorGrade(new Float32Array([0.3, 0.4, 0.45, 1]), u, out);
    expect(out[0]).toBeCloseTo(0.6, 6);
    expect(out[1]).toBeCloseTo(0.8, 6);
    expect(out[2]).toBeCloseTo(0.9, 6);
  });

  it('saturation 0 collapses to BT.709 luma', () => {
    const u = colorGradeUniforms({ type: 'color-grade', saturation: 0 });
    const out = new Float32Array(4);
    applyColorGrade(new Float32Array([1, 0, 0, 1]), u, out);
    // BT.709 luma of pure red = 0.2126.
    expect(out[0]).toBeCloseTo(0.2126, 5);
    expect(out[1]).toBeCloseTo(0.2126, 5);
    expect(out[2]).toBeCloseTo(0.2126, 5);
  });

  it('clamps the output channels to [0,1]', () => {
    const u = colorGradeUniforms({ type: 'color-grade', exposure: 10 });
    const out = new Float32Array(4);
    applyColorGrade(new Float32Array([0.9, -0.5, 0.5, 1]), u, out);
    expect(out[0]).toBe(1);
    // Negative input + identity gamma → still negative pre-clamp → clamps to 0.
    expect(out[1]).toBe(0);
    expect(out[2]).toBe(1);
  });

  it('substitutes the default for non-finite lift channels', () => {
    const u = colorGradeUniforms({
      type: 'color-grade',
      lift: [Number.NaN, Number.POSITIVE_INFINITY, 0] as [number, number, number],
    });
    expect(u.lift[0]).toBe(0);
    expect(u.lift[1]).toBe(0);
    expect(u.lift[2]).toBe(0);
  });

  it('treats NaN per-pixel inputs as 0 in the clamp', () => {
    const u = colorGradeUniforms({ type: 'color-grade' });
    const out = new Float32Array(4);
    applyColorGrade(new Float32Array([Number.NaN, 0.5, 0.5, 1]), u, out);
    expect(out[0]).toBe(0);
    expect(out[3]).toBe(1);
  });
});
