import type { ThemeManifest } from '@bach/core';

/**
 * Broadcast — high-contrast neutrals, slightly desaturated, optimised
 * for live programming. Compact controls, red accent for the
 * recording / on-air indication consumers usually wrap around the
 * progress region.
 */
export const broadcastTheme: ThemeManifest = {
  version: 1,
  layout: 'default',
  cssVariables: {
    '--bach-color-bg': '#0c0f12',
    '--bach-color-fg': '#f5f5f5',
    '--bach-color-accent': '#e53935',
    '--bach-color-muted': '#9aa0a6',
    '--bach-progress-track': 'rgba(245, 245, 245, 0.16)',
    '--bach-progress-fill': '#e53935',
    '--bach-progress-buffer': 'rgba(229, 57, 53, 0.45)',
    '--bach-radius': '4px',
    '--bach-control-size': '34px',
    '--bach-control-gap': '6px',
    '--bach-overlay-bg': 'rgba(12, 15, 18, 0.92)',
    '--bach-overlay-blur': '4px',
  },
};

export default broadcastTheme;
