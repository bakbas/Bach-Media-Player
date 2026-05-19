import { describe, expect, it } from 'vitest';
import { type Effect, isKnownEffect, mergeChains, normaliseChain } from './effects.js';

const grade: Effect = { type: 'color-grade', exposure: 1.05 };
const grain: Effect = { type: 'film-grain', amount: 0.05 };

describe('isKnownEffect', () => {
  it('accepts each registered type', () => {
    for (const fx of [
      { type: 'color-grade' },
      { type: 'lut', cube: { size: 2, data: new Float32Array(2 * 2 * 2 * 3) } },
      { type: 'blur-region', region: { x: 0, y: 0, width: 1, height: 1 } },
      { type: 'watermark', image: {} },
      { type: 'film-grain' },
    ] as Effect[]) {
      expect(isKnownEffect(fx)).toBe(true);
    }
  });
  it('rejects unknown types', () => {
    expect(isKnownEffect({ type: 'hax' } as unknown as Effect)).toBe(false);
  });
});

describe('normaliseChain', () => {
  it('drops null and undefined entries', () => {
    expect(normaliseChain([grade, null, undefined, grain])).toEqual([grade, grain]);
  });
  it('strips effects with unknown types', () => {
    const evil = { type: 'arbitrary-css', payload: '<script>' } as unknown as Effect;
    expect(normaliseChain([grade, evil, grain])).toEqual([grade, grain]);
  });
  it('returns a fresh array (no aliasing with input)', () => {
    const input = [grade];
    const out = normaliseChain(input);
    out.push(grain);
    expect(input).toHaveLength(1);
  });
});

describe('mergeChains', () => {
  it('concatenates multiple chains and normalises in one pass', () => {
    expect(
      mergeChains([grade], undefined, [null, grain, { type: 'oops' } as unknown as Effect]),
    ).toEqual([grade, grain]);
  });
  it('returns empty for all-empty inputs', () => {
    expect(mergeChains()).toEqual([]);
    expect(mergeChains(undefined, [])).toEqual([]);
  });
});
