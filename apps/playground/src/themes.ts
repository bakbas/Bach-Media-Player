import type { ThemeManifest } from '@bach/core';
import {
  BACH_THEMES,
  type BachThemeName,
  broadcastTheme,
  cinematicTheme,
  minimalTheme,
  terminalTheme,
  vintageTheme,
} from '@bach/themes';

/**
 * Playground preset registry — the five curated themes that ship in
 * `@bach/themes`, plus a hand-built "neon" entry that exercises the
 * `oklch()` value path and a richer accent palette. Reusing the
 * package presets verbatim keeps the demo honest: the skin gallery is
 * literally what consumers get when they `import '@bach/themes'`.
 */
const neon: ThemeManifest = {
  version: 1,
  layout: 'default',
  cssVariables: {
    '--bach-color-bg': '#0a0014',
    '--bach-color-fg': '#f0e9ff',
    '--bach-color-accent': 'oklch(0.75 0.3 320)',
    '--bach-color-muted': '#9d77c4',
    '--bach-progress-fill': 'oklch(0.75 0.3 320)',
    '--bach-progress-track': 'oklch(0.3 0.1 320)',
    '--bach-progress-buffer': 'oklch(0.5 0.2 320)',
    '--bach-radius': '20px',
    '--bach-control-size': '38px',
    '--bach-overlay-bg': 'rgba(10, 0, 20, 0.9)',
    '--bach-overlay-blur': '14px',
  },
};

export type PresetName = BachThemeName | 'neon';

export const PRESETS: Record<PresetName, ThemeManifest> = {
  ...BACH_THEMES,
  neon,
};

export interface SkinSummary {
  name: PresetName;
  label: string;
  description: string;
  /** Three swatch colours pulled from the manifest, in display order. */
  swatches: [string, string, string];
}

const ACCENT = '--bach-color-accent';
const BG = '--bach-color-bg';
const FG = '--bach-color-fg';

function pluck(manifest: ThemeManifest, key: string, fallback: string): string {
  return (
    manifest.cssVariables?.[key as keyof NonNullable<ThemeManifest['cssVariables']>] ?? fallback
  );
}

/**
 * Static description set used by the gallery — keeps the demo
 * self-contained so the gallery cards always have a one-line story
 * even if a preset never changes.
 */
export const SKIN_SUMMARIES: ReadonlyArray<SkinSummary> = [
  {
    name: 'minimal',
    label: 'Minimal',
    description:
      'Quiet light theme. Greys with a single accent — sits behind docs and education sites without fighting the page.',
    swatches: [
      pluck(minimalTheme, BG, '#fafafa'),
      pluck(minimalTheme, FG, '#111111'),
      pluck(minimalTheme, ACCENT, '#111111'),
    ],
  },
  {
    name: 'cinematic',
    label: 'Cinematic',
    description:
      'Deep blacks with a warm-gold accent. Thick rounded chrome — reads as a dedicated viewing experience.',
    swatches: [
      pluck(cinematicTheme, BG, '#000000'),
      pluck(cinematicTheme, FG, '#f5e6c8'),
      pluck(cinematicTheme, ACCENT, '#d4af37'),
    ],
  },
  {
    name: 'broadcast',
    label: 'Broadcast',
    description:
      'High-contrast neutrals with a red accent. Compact controls suited to live news / sports programming.',
    swatches: [
      pluck(broadcastTheme, BG, '#0c0f12'),
      pluck(broadcastTheme, FG, '#f5f5f5'),
      pluck(broadcastTheme, ACCENT, '#e53935'),
    ],
  },
  {
    name: 'terminal',
    label: 'Terminal',
    description:
      'Monospaced, green-on-black phosphor. The font-family override stays in the parser-allowed grammar.',
    swatches: [
      pluck(terminalTheme, BG, '#001100'),
      pluck(terminalTheme, FG, '#33ff33'),
      pluck(terminalTheme, ACCENT, '#66ff66'),
    ],
  },
  {
    name: 'vintage',
    label: 'Vintage',
    description:
      'Warm sepia / cream with a deep amber accent. Pairs with the @bach/gpu-fx vintage color grade.',
    swatches: [
      pluck(vintageTheme, BG, '#1a120b'),
      pluck(vintageTheme, FG, '#f1e3c6'),
      pluck(vintageTheme, ACCENT, '#c98a3a'),
    ],
  },
  {
    name: 'neon',
    label: 'Neon (custom)',
    description:
      'Hand-built showcase of oklch() values — the same parser accepts the four documented color formats.',
    swatches: [
      pluck(neon, BG, '#0a0014'),
      pluck(neon, FG, '#f0e9ff'),
      pluck(neon, ACCENT, 'oklch(0.75 0.3 320)'),
    ],
  },
];
