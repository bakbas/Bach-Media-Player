import { describe, expect, it } from 'vitest';
import { CSS_VARIABLE_TOKENS, PART_NAMES } from './theming.js';

describe('theming contract', () => {
  it('exposes the documented CSS variable surface', () => {
    const names = Object.keys(CSS_VARIABLE_TOKENS);
    expect(names).toContain('--bach-color-accent');
    expect(names).toContain('--bach-progress-fill');
    expect(names).toContain('--bach-radius');
    expect(names.every((n) => n.startsWith('--bach-'))).toBe(true);
  });

  it('every CSS variable has a type + description', () => {
    for (const [name, meta] of Object.entries(CSS_VARIABLE_TOKENS)) {
      expect(meta.type, `${name} type`).toBeTypeOf('string');
      expect(meta.description.length, `${name} description`).toBeGreaterThan(8);
    }
  });

  it('exports stable part names', () => {
    expect(PART_NAMES).toContain('play-button');
    expect(PART_NAMES).toContain('progress-bar');
    expect(PART_NAMES).toContain('caption-overlay');
    expect(new Set(PART_NAMES).size).toBe(PART_NAMES.length);
  });
});
