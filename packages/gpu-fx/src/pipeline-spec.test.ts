import { describe, expect, it } from 'vitest';
import type { Effect } from './effects.js';
import { identityLut } from './lut.js';
import { buildPipelineSpec } from './pipeline-spec.js';

describe('buildPipelineSpec', () => {
  it('translates each effect into one pass with a stable id', () => {
    const spec = buildPipelineSpec({
      effects: [
        { type: 'color-grade', exposure: 1.05 },
        { type: 'film-grain', amount: 0.05 },
      ],
    });
    expect(spec.passes).toHaveLength(2);
    expect(spec.passes[0]?.id).toBe('0-color-grade');
    expect(spec.passes[1]?.id).toBe('1-film-grain');
    expect(spec.passes[0]?.fragmentSource).toContain('@fragment');
  });

  it('reuses the shared fullscreen vertex source for every pass', () => {
    const spec = buildPipelineSpec({
      effects: [{ type: 'color-grade' }, { type: 'film-grain' }],
    });
    const sources = new Set(spec.passes.map((p) => p.vertexSource));
    expect(sources.size).toBe(1);
  });

  it('packs color-grade uniforms with exposure at offset 0', () => {
    const spec = buildPipelineSpec({
      effects: [{ type: 'color-grade', exposure: 2 }],
    });
    expect(spec.passes[0]?.uniforms[0]).toBe(2);
  });

  it('exposes the LUT cube on the lut pass as an auxiliary resource', () => {
    const lut = identityLut(2);
    const spec = buildPipelineSpec({
      effects: [{ type: 'lut', cube: lut, intensity: 0.5 }],
    });
    expect(spec.passes[0]?.auxiliary[0]).toEqual({ kind: 'lut3d', cube: lut });
    expect(spec.passes[0]?.uniforms[0]).toBeCloseTo(0.5, 6);
  });

  it('encodes resolution into the blur-region pass', () => {
    const spec = buildPipelineSpec({
      effects: [
        {
          type: 'blur-region',
          region: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
          radius: 12,
        },
      ],
      resolution: { width: 1280, height: 720 },
    });
    const u = spec.passes[0]?.uniforms as Float32Array;
    expect(u[0]).toBeCloseTo(0.1, 6);
    expect(u[1]).toBeCloseTo(0.2, 6);
    expect(u[2]).toBeCloseTo(0.3, 6);
    expect(u[3]).toBeCloseTo(0.4, 6);
    expect(u[4]).toBe(12);
    expect(u[8]).toBeCloseTo(1 / 1280, 8);
    expect(u[9]).toBeCloseTo(1 / 720, 8);
  });

  it('film-grain seed defaults to now() and is overridden when provided', () => {
    const fixed = buildPipelineSpec({
      effects: [{ type: 'film-grain', amount: 0.1, seed: 42 }],
      now: () => 9_999,
    });
    expect(fixed.passes[0]?.uniforms[1]).toBe(42);
    const auto = buildPipelineSpec({
      effects: [{ type: 'film-grain', amount: 0.1 }],
      now: () => 9_999,
    });
    expect(auto.passes[0]?.uniforms[1]).toBe(9_999);
  });

  it('skips effects whose type has no registered shader', () => {
    const spec = buildPipelineSpec({
      effects: [{ type: 'mystery' } as unknown as Effect, { type: 'color-grade' }],
    });
    expect(spec.passes).toHaveLength(1);
    expect(spec.passes[0]?.effectType).toBe('color-grade');
  });

  it('clamps watermark opacity into [0,1]', () => {
    const spec = buildPipelineSpec({
      effects: [{ type: 'watermark', image: {}, opacity: 2 }],
    });
    expect(spec.passes[0]?.uniforms[4]).toBe(1);
  });
});
