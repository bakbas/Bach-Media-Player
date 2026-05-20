import { applyTheme } from '@bach/core';
import { describe, expect, it } from 'vitest';
import { BACH_THEMES, BACH_THEME_NAMES, getBachTheme } from './index.js';

describe('@bach/themes registry', () => {
  it('exposes the five documented presets', () => {
    expect([...BACH_THEME_NAMES].sort()).toEqual([
      'broadcast',
      'cinematic',
      'minimal',
      'terminal',
      'vintage',
    ]);
  });

  it('every preset has version: 1 and a layout', () => {
    for (const name of BACH_THEME_NAMES) {
      const theme = BACH_THEMES[name];
      expect(theme.version).toBe(1);
      expect(typeof theme.layout).toBe('string');
    }
  });

  it('getBachTheme returns null for unknown names', () => {
    expect(getBachTheme('galactic')).toBeNull();
    expect(getBachTheme('__proto__')).toBeNull();
    expect(getBachTheme('cinematic')).toBe(BACH_THEMES.cinematic);
  });
});

describe('Every preset passes applyTheme without rejections', () => {
  for (const name of BACH_THEME_NAMES) {
    it(`${name} applies cleanly to a host element`, () => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const theme = BACH_THEMES[name];
      const result = applyTheme(host, theme);
      if (result.rejected.length > 0) {
        throw new Error(
          `${name} preset failed schema: ${result.rejected.map((r) => `${r.key}=${String(r.value)}: ${r.reason}`).join('; ')}`,
        );
      }
      // Every css variable in the preset should have landed.
      const declared = Object.keys(theme.cssVariables ?? {});
      const applied = Object.keys(result.applied);
      expect(applied.sort()).toEqual(declared.sort());
      // The layout attribute should be reflected.
      expect(host.getAttribute('data-layout')).toBe(theme.layout);
    });
  }
});
