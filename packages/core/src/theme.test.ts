import { describe, expect, it } from 'vitest';
import { applyTheme } from './theme.js';

function host(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

describe('applyTheme — happy path', () => {
  it('applies valid CSS variables', () => {
    const el = host();
    const result = applyTheme(el, {
      version: 1,
      cssVariables: {
        '--bach-color-accent': 'oklch(0.7 0.2 250)',
        '--bach-radius': '12px',
      },
    });
    expect(result.applied['--bach-color-accent']).toBe('oklch(0.7 0.2 250)');
    expect(result.applied['--bach-radius']).toBe('12px');
    expect(result.rejected).toHaveLength(0);
    expect(el.style.getPropertyValue('--bach-color-accent')).toBe('oklch(0.7 0.2 250)');
  });

  it('accepts the three supported layouts', () => {
    for (const layout of ['default', 'compact', 'cinematic'] as const) {
      const el = host();
      const result = applyTheme(el, { version: 1, layout });
      expect(result.layout).toBe(layout);
      expect(el.getAttribute('data-layout')).toBe(layout);
    }
  });

  it('accepts hex, oklch, rgb, and currentcolor', () => {
    const el = host();
    const colors = [
      '#f06',
      '#ff0066',
      'rgb(255, 0, 102)',
      'oklch(0.7 0.2 30)',
      'currentcolor',
      'transparent',
    ];
    for (const value of colors) {
      const r = applyTheme(el, { version: 1, cssVariables: { '--bach-color-accent': value } });
      expect(r.rejected, `${value} should be accepted`).toHaveLength(0);
    }
  });

  it('accepts length values with the supported units', () => {
    const el = host();
    for (const value of ['12px', '0.5rem', '1.25em', '50%', '100vh']) {
      const r = applyTheme(el, { version: 1, cssVariables: { '--bach-radius': value } });
      expect(r.rejected, `${value} should be accepted`).toHaveLength(0);
    }
  });
});

describe('applyTheme — schema rejections', () => {
  it('rejects null and non-objects', () => {
    expect(applyTheme(host(), null).rejected[0]?.reason).toMatch(/must be a JSON object/);
    expect(applyTheme(host(), 'theme').rejected[0]?.reason).toMatch(/must be a JSON object/);
    expect(applyTheme(host(), 42).rejected[0]?.reason).toMatch(/must be a JSON object/);
  });

  it('rejects manifests with the wrong version', () => {
    expect(applyTheme(host(), { version: 2 }).rejected[0]?.reason).toMatch(/expected version: 1/);
  });

  it('rejects unknown CSS variable names', () => {
    const r = applyTheme(host(), {
      version: 1,
      cssVariables: { '--evil': 'red' },
    });
    expect(r.applied).toEqual({});
    expect(r.rejected[0]?.reason).toMatch(/unknown css variable/);
  });

  it('rejects non-string CSS variable values', () => {
    const r = applyTheme(host(), {
      version: 1,
      cssVariables: { '--bach-radius': 12 as unknown as string },
    });
    expect(r.rejected[0]?.reason).toMatch(/must be a string/);
  });

  it('rejects unknown top-level fields', () => {
    const r = applyTheme(host(), { version: 1, somethingExtra: 'oh hi' });
    expect(r.rejected.some((rej) => rej.key === 'somethingExtra')).toBe(true);
  });

  it('rejects unknown layout values', () => {
    const r = applyTheme(host(), { version: 1, layout: 'evil' });
    expect(r.rejected[0]?.reason).toMatch(/one of/);
  });
});

describe('applyTheme — security boundary (foundation for Phase 5 conducting)', () => {
  const cases: Array<{ name: string; value: string }> = [
    { name: 'angle brackets', value: '<script>alert(1)</script>' },
    { name: 'inline url()', value: 'url(https://evil.example/x.png)' },
    { name: 'CSS expression()', value: 'expression(alert(1))' },
    { name: 'javascript: scheme', value: 'javascript:alert(1)' },
    { name: 'data: scheme', value: 'data:text/html,<x>' },
    { name: 'css block break', value: '#fff; background: red' },
    { name: 'curly brace', value: '#fff { background: red }' },
    { name: '@import smuggling', value: '@import "evil"' },
  ];

  for (const c of cases) {
    it(`rejects ${c.name}`, () => {
      const el = host();
      const r = applyTheme(el, {
        version: 1,
        cssVariables: { '--bach-color-accent': c.value },
      });
      expect(r.applied['--bach-color-accent']).toBeUndefined();
      expect(r.rejected).toHaveLength(1);
      expect(el.style.getPropertyValue('--bach-color-accent')).toBe('');
    });
  }

  it('rejects values longer than 256 characters', () => {
    const value = `#${'0'.repeat(260)}`;
    const r = applyTheme(host(), {
      version: 1,
      cssVariables: { '--bach-color-accent': value },
    });
    expect(r.rejected[0]?.reason).toMatch(/256 characters/);
  });

  it('rejects values that pass danger but fail the type regex', () => {
    const r = applyTheme(host(), {
      version: 1,
      cssVariables: { '--bach-color-accent': 'NotAColor' },
    });
    expect(r.rejected[0]?.reason).toMatch(/color pattern/);
  });
});
