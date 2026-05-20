import type { ThemeManifest } from '@bach/core';

/**
 * Vintage — warm sepia / cream, with a deep amber accent. Pairs well
 * with a `@bach/gpu-fx` vintage colour grade for a "rescued from a
 * VHS" look.
 */
export const vintageTheme: ThemeManifest = {
  version: 1,
  layout: 'default',
  cssVariables: {
    '--bach-color-bg': '#1a120b',
    '--bach-color-fg': '#f1e3c6',
    '--bach-color-accent': '#c98a3a',
    '--bach-color-muted': '#a08566',
    '--bach-progress-track': 'rgba(241, 227, 198, 0.18)',
    '--bach-progress-fill': '#c98a3a',
    '--bach-progress-buffer': 'rgba(201, 138, 58, 0.45)',
    '--bach-radius': '6px',
    '--bach-control-size': '36px',
    '--bach-control-gap': '8px',
    '--bach-overlay-bg': 'rgba(26, 18, 11, 0.88)',
    '--bach-overlay-blur': '6px',
  },
};

export default vintageTheme;
