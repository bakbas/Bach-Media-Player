/**
 * Manifest fuzz harness. Generates a battery of malicious inputs and
 * checks that `@bach/core/applyTheme` rejects every one of them — the
 * security model claims the parser is the boundary, and this is the
 * proof. The Phase 5 release pipeline runs this against a real
 * `<bach-player>` mount; release blocks on any leakage.
 */

import type { ApplyThemeResult } from '@bach/core';

/** All registered Bach CSS variables (mirrors the public token contract). */
const BACH_VARIABLES = [
  '--bach-color-bg',
  '--bach-color-fg',
  '--bach-color-accent',
  '--bach-color-muted',
  '--bach-radius',
  '--bach-control-size',
  '--bach-control-gap',
  '--bach-progress-track',
  '--bach-progress-fill',
  '--bach-progress-buffer',
  '--bach-font-family',
  '--bach-font-size',
  '--bach-overlay-bg',
  '--bach-overlay-blur',
] as const;

/**
 * Hand-crafted payloads. Every entry is a value the schema must reject
 * because it could break out of the property position into HTML, CSS, or
 * JS context. Keep them sorted by category for readability.
 */
const XSS_VECTORS = [
  // HTML escape
  '<script>alert(1)</script>',
  '"><script>alert(1)</script>',
  "'><script>alert(1)</script>",
  '<img src=x onerror=alert(1)>',
  // CSS exfil
  'url(https://evil.example/x.png)',
  'url("//evil.example/x")',
  'url(/relative)',
  '@import "evil"',
  '@import url(evil)',
  // IE-era CSS expression
  'expression(alert(1))',
  'expr/**/ession(alert(1))',
  // JS / data scheme
  'javascript:alert(1)',
  'JavaScript:alert(1)',
  'data:text/html,<script>',
  'data:image/svg+xml,<svg onload=alert(1)>',
  // CSS block breakout
  '#fff; background: url(x)',
  '#fff } .x { display:none',
  '#fff /* comment */ ; color: red',
  // Unicode / encoding tricks
  '\\3C script\\3E alert(1)\\3C /script\\3E',
  '%3Cscript%3Ealert(1)%3C/script%3E',
  // Charset / vendor smuggling
  '@charset "iso-8859-1"',
  // Way too long
  `#${'0'.repeat(1024)}`,
  // Object-shaped sneaks
  '[object Object]',
];

/**
 * Synthesise a much larger battery by combining vectors with each
 * registered CSS variable name plus a few full-manifest sneaks.
 */
export interface FuzzCase {
  label: string;
  manifest: unknown;
}

export function generateFuzzCases(): FuzzCase[] {
  const cases: FuzzCase[] = [];

  // 1. Every documented variable × every XSS vector.
  for (const key of BACH_VARIABLES) {
    for (const value of XSS_VECTORS) {
      cases.push({
        label: `${key}=${truncate(value)}`,
        manifest: {
          version: 1,
          cssVariables: { [key]: value },
        },
      });
    }
  }

  // 2. Unknown variable names. The parser must drop the entire pair.
  for (const sneaky of [
    '--bach-custom-css',
    '--unknown',
    '__proto__',
    'constructor',
    'background',
  ]) {
    cases.push({
      label: `unknown-key:${sneaky}`,
      manifest: { version: 1, cssVariables: { [sneaky]: 'red' } },
    });
  }

  // 3. Non-string values for documented keys.
  for (const bogus of [42, true, null, ['x'], { x: 1 }]) {
    cases.push({
      label: `non-string:${typeof bogus}`,
      manifest: {
        version: 1,
        cssVariables: { '--bach-color-accent': bogus },
      },
    });
  }

  // 4. Unknown layout enum + extra top-level fields.
  cases.push({
    label: 'unknown-layout',
    manifest: { version: 1, layout: 'evil' },
  });
  cases.push({
    label: 'extra-top-level',
    manifest: { version: 1, exec: '<script>' },
  });
  cases.push({
    label: 'wrong-version',
    manifest: { version: 99, cssVariables: { '--bach-color-bg': '#000' } },
  });

  // 5. Manifest-not-an-object family.
  for (const not of [null, 42, 'theme', [], true]) {
    cases.push({ label: `not-object:${typeof not}`, manifest: not });
  }

  return cases;
}

function truncate(text: string): string {
  return text.length > 32 ? `${text.slice(0, 29)}...` : text;
}

export interface FuzzReport {
  total: number;
  passed: number;
  failures: Array<{ case: FuzzCase; result: ApplyThemeResult }>;
}

/**
 * Run every fuzz case against a real `applyTheme`-shaped function and
 * verify that the safe-variable surface stays empty. The release-block
 * predicate is `report.failures.length === 0`.
 */
export function runFuzz(
  apply: (manifest: unknown) => ApplyThemeResult,
  cases: ReadonlyArray<FuzzCase> = generateFuzzCases(),
): FuzzReport {
  const failures: Array<{ case: FuzzCase; result: ApplyThemeResult }> = [];
  let passed = 0;
  for (const c of cases) {
    const result = apply(c.manifest);
    if (Object.keys(result.applied).length === 0) {
      passed += 1;
    } else {
      failures.push({ case: c, result });
    }
  }
  return { total: cases.length, passed, failures };
}
