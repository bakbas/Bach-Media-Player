import type { ThemeManifest } from '@bach/core';

/**
 * Cinematic — deep blacks with a warm-gold accent. Designed to read as
 * "lights-down theatre", with thick rounded chrome that suggests a
 * dedicated viewing experience rather than a tab in a feed.
 */
export const cinematicTheme: ThemeManifest = {
  version: 1,
  layout: 'cinematic',
  cssVariables: {
    '--bach-color-bg': '#000000',
    '--bach-color-fg': '#f5e6c8',
    '--bach-color-accent': '#d4af37',
    '--bach-color-muted': '#8a7a5b',
    '--bach-progress-track': 'rgba(245, 230, 200, 0.18)',
    '--bach-progress-fill': '#d4af37',
    '--bach-progress-buffer': 'rgba(212, 175, 55, 0.45)',
    '--bach-radius': '14px',
    '--bach-control-size': '40px',
    '--bach-control-gap': '10px',
    '--bach-overlay-bg': 'rgba(0, 0, 0, 0.85)',
    '--bach-overlay-blur': '12px',
    '--bach-font-size': '14px',
  },
};

export default cinematicTheme;
