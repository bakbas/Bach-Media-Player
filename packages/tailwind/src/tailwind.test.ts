import { CSS_VARIABLE_TOKENS } from '@bach/core';
import { describe, expect, it } from 'vitest';
import {
  COLOR_VARIABLES,
  FONT_FAMILY_VARIABLES,
  LENGTH_VARIABLES,
  bachTailwindPreset,
  shortName,
} from './index.js';

describe('Bach Tailwind preset', () => {
  it('groups every documented token by type', () => {
    const totalDocs = Object.keys(CSS_VARIABLE_TOKENS).length;
    expect(COLOR_VARIABLES.length + LENGTH_VARIABLES.length + FONT_FAMILY_VARIABLES.length).toBe(
      totalDocs,
    );
  });

  it('shortName strips the --bach- prefix', () => {
    expect(shortName('--bach-color-accent')).toBe('color-accent');
    expect(shortName('--bach-radius')).toBe('radius');
  });

  it('preset exposes colors under the bach-* namespace', () => {
    const preset = bachTailwindPreset();
    expect(preset.theme.extend.colors['bach-accent']).toBe('var(--bach-color-accent)');
    expect(preset.theme.extend.colors['bach-bg']).toBe('var(--bach-color-bg)');
    expect(preset.theme.extend.colors['bach-fg']).toBe('var(--bach-color-fg)');
  });

  it('preset exposes the radius token under borderRadius', () => {
    const preset = bachTailwindPreset();
    expect(preset.theme.extend.borderRadius['bach-radius']).toBe('var(--bach-radius)');
  });

  it('preset exposes control-size and gap under spacing', () => {
    const preset = bachTailwindPreset();
    expect(preset.theme.extend.spacing['bach-control-size']).toBe('var(--bach-control-size)');
    expect(preset.theme.extend.spacing['bach-control-gap']).toBe('var(--bach-control-gap)');
  });

  it('preset exposes the font family + size tokens', () => {
    const preset = bachTailwindPreset();
    expect(preset.theme.extend.fontFamily['bach-family']).toBe('var(--bach-font-family)');
    expect(preset.theme.extend.fontSize['bach-size']).toBe('var(--bach-font-size)');
  });

  it('every CSS variable reachable from at least one Tailwind entry', () => {
    const preset = bachTailwindPreset();
    const allValues = new Set<string>([
      ...Object.values(preset.theme.extend.colors),
      ...Object.values(preset.theme.extend.borderRadius),
      ...Object.values(preset.theme.extend.spacing),
      ...Object.values(preset.theme.extend.fontFamily),
      ...Object.values(preset.theme.extend.fontSize),
    ]);
    for (const token of Object.keys(CSS_VARIABLE_TOKENS)) {
      expect(allValues, `${token} should be reachable from a Tailwind class`).toContain(
        `var(${token})`,
      );
    }
  });
});
