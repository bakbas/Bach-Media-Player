import { describe, expect, it } from 'vitest';
import { isKnownEffect } from './effects.js';
import { PRESETS, type PresetName, getPreset } from './presets.js';

describe('presets', () => {
  it('exposes the documented preset names', () => {
    expect(Object.keys(PRESETS).sort()).toEqual(['broadcast', 'cinematic', 'minimal', 'vintage']);
  });

  it('every preset contains only known effects', () => {
    for (const name of Object.keys(PRESETS) as PresetName[]) {
      for (const fx of PRESETS[name]) {
        expect(isKnownEffect(fx)).toBe(true);
      }
    }
  });

  it('cinematic preset uses color-grade + film-grain', () => {
    const fx = PRESETS.cinematic.map((e) => e.type);
    expect(fx).toContain('color-grade');
    expect(fx).toContain('film-grain');
  });

  it('getPreset returns the same array reference', () => {
    expect(getPreset('vintage')).toBe(PRESETS.vintage);
  });
});
