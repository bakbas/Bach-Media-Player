import { applyTheme } from '@bach/core';
import { describe, expect, it } from 'vitest';
import { generateFuzzCases, runFuzz } from './fuzz.js';

describe('generateFuzzCases', () => {
  it('produces a substantial battery (>= 300 cases)', () => {
    const cases = generateFuzzCases();
    expect(cases.length).toBeGreaterThanOrEqual(300);
  });

  it('every case has a label and a manifest field', () => {
    for (const c of generateFuzzCases().slice(0, 20)) {
      expect(typeof c.label).toBe('string');
      expect(c.label.length).toBeGreaterThan(0);
      expect('manifest' in c).toBe(true);
    }
  });
});

describe('runFuzz against @bach/core applyTheme', () => {
  it('rejects every case — zero leakage', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const report = runFuzz((manifest) => applyTheme(host, manifest));
    if (report.failures.length > 0) {
      const sample = report.failures.slice(0, 5).map((f) => f.case.label);
      throw new Error(
        `Bach conduct: ${report.failures.length} fuzz cases leaked. First five: ${sample.join(', ')}`,
      );
    }
    expect(report.passed).toBe(report.total);
  });

  it('a known-good manifest still applies cleanly outside the fuzz set', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const result = applyTheme(host, {
      version: 1,
      cssVariables: { '--bach-color-accent': 'oklch(0.7 0.18 250)' },
    });
    expect(Object.keys(result.applied)).toContain('--bach-color-accent');
  });
});
