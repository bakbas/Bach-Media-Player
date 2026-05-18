import type { ThemeManifest } from '@bach/core';

/**
 * Four hand-crafted theme presets that exercise the four documented value
 * shapes (color, length, font-family) and the layout enum. These act as
 * smoke fixtures for the manifest validator until the full @bach/themes
 * catalogue ships in Phase 5.
 */
export const PRESETS: Record<string, ThemeManifest> = {
  default: {
    version: 1,
    cssVariables: {
      '--bach-color-bg': 'oklch(0.18 0 0)',
      '--bach-color-fg': 'oklch(0.96 0 0)',
      '--bach-color-accent': 'oklch(0.7 0.18 250)',
      '--bach-radius': '12px',
      '--bach-control-size': '36px',
    },
    layout: 'default',
  },
  cinematic: {
    version: 1,
    cssVariables: {
      '--bach-color-bg': '#000000',
      '--bach-color-fg': '#f5e6c8',
      '--bach-color-accent': '#d4af37',
      '--bach-overlay-bg': 'rgba(0, 0, 0, 0.85)',
      '--bach-radius': '0px',
      '--bach-control-size': '40px',
    },
    layout: 'cinematic',
  },
  minimal: {
    version: 1,
    cssVariables: {
      '--bach-color-bg': '#fafafa',
      '--bach-color-fg': '#111111',
      '--bach-color-accent': '#111111',
      '--bach-progress-track': '#dddddd',
      '--bach-radius': '2px',
      '--bach-control-size': '32px',
    },
    layout: 'compact',
  },
  neon: {
    version: 1,
    cssVariables: {
      '--bach-color-bg': '#0a0014',
      '--bach-color-fg': '#f0e9ff',
      '--bach-color-accent': 'oklch(0.75 0.3 320)',
      '--bach-progress-fill': 'oklch(0.75 0.3 320)',
      '--bach-progress-track': 'oklch(0.3 0.1 320)',
      '--bach-radius': '20px',
    },
    layout: 'default',
  },
};
