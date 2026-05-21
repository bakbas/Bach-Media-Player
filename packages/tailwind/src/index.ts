import { type BachCssVariable, CSS_VARIABLE_TOKENS } from '@bach/core';

/**
 * Tailwind preset plugin. Exposes the Bach Media Player CSS variable
 * contract — `--bach-color-accent`, `--bach-radius`, …, every token in
 * `CSS_VARIABLE_TOKENS` — as native Tailwind theme entries. Now an
 * app's tailwind.config can compose Bach tokens with the rest of the
 * design system:
 *
 *   import bach from '@bach/tailwind';
 *   export default { presets: [bach()] };
 *
 *   <button class="bg-bach-accent rounded-bach-md">Play</button>
 *
 * The plugin is intentionally minimal — no opinionated component
 * classes, no utility shorthand. The single contract is "every public
 * Bach token is reachable from a Tailwind class", which keeps the
 * footprint trivial and forward-compatible with both Tailwind 3 and 4.
 */

const COLOR_VARIABLES = Object.entries(CSS_VARIABLE_TOKENS)
  .filter(([, meta]) => meta.type === 'color')
  .map(([name]) => name as BachCssVariable);

const LENGTH_VARIABLES = Object.entries(CSS_VARIABLE_TOKENS)
  .filter(([, meta]) => meta.type === 'length')
  .map(([name]) => name as BachCssVariable);

const FONT_FAMILY_VARIABLES = Object.entries(CSS_VARIABLE_TOKENS)
  .filter(([, meta]) => meta.type === 'font-family')
  .map(([name]) => name as BachCssVariable);

/** Strip the `--bach-` prefix and surface the rest as the Tailwind key. */
function shortName(token: BachCssVariable): string {
  return token.replace(/^--bach-/, '');
}

function buildScale(tokens: ReadonlyArray<BachCssVariable>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const token of tokens) {
    out[shortName(token)] = `var(${token})`;
  }
  return out;
}

export interface BachTailwindPresetOptions {
  /**
   * Tailwind 3 expects extensions under `theme.extend`. Tailwind 4
   * accepts the same plugin shape; the preset is identical in both.
   */
  prefix?: string;
}

/** The shape Tailwind expects from a preset module. */
export interface TailwindPreset {
  theme: {
    extend: {
      colors: Record<string, string>;
      borderRadius: Record<string, string>;
      spacing: Record<string, string>;
      fontFamily: Record<string, string>;
      fontSize: Record<string, string>;
    };
  };
}

/**
 * Build a Tailwind preset that maps every public Bach token to a
 * Tailwind theme entry. Prefix every short name with `bach-` so it
 * never collides with the consumer's design system (`bg-bach-accent`
 * not `bg-accent`).
 */
export function bachTailwindPreset(_opts: BachTailwindPresetOptions = {}): TailwindPreset {
  const colors: Record<string, string> = {};
  for (const token of COLOR_VARIABLES) {
    colors[`bach-${shortName(token).replace(/^color-/, '')}`] = `var(${token})`;
  }

  const radius: Record<string, string> = {};
  const spacing: Record<string, string> = {};
  for (const token of LENGTH_VARIABLES) {
    const short = `bach-${shortName(token)}`;
    if (token.includes('radius')) {
      radius[short] = `var(${token})`;
    } else {
      spacing[short] = `var(${token})`;
    }
  }

  const fontFamily: Record<string, string> = {};
  for (const token of FONT_FAMILY_VARIABLES) {
    fontFamily[`bach-${shortName(token).replace(/^font-/, '')}`] = `var(${token})`;
  }
  const fontSize: Record<string, string> = {
    'bach-size': 'var(--bach-font-size)',
  };

  return {
    theme: {
      extend: {
        colors,
        borderRadius: radius,
        spacing,
        fontFamily,
        fontSize,
      },
    },
  };
}

export default bachTailwindPreset;

export { COLOR_VARIABLES, LENGTH_VARIABLES, FONT_FAMILY_VARIABLES, shortName, buildScale };
