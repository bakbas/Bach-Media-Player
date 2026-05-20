import type { ThemeManifest } from '@bach/core';

/**
 * Minimal — quiet light theme that puts everything in muted greys with
 * a single accent. Good default for docs / education sites where the
 * video should not fight the surrounding chrome.
 */
export const minimalTheme: ThemeManifest = {
  version: 1,
  layout: 'compact',
  cssVariables: {
    '--bach-color-bg': '#fafafa',
    '--bach-color-fg': '#111111',
    '--bach-color-accent': '#111111',
    '--bach-color-muted': '#777777',
    '--bach-progress-track': '#dddddd',
    '--bach-progress-fill': '#111111',
    '--bach-progress-buffer': '#bbbbbb',
    '--bach-radius': '2px',
    '--bach-control-size': '32px',
    '--bach-control-gap': '6px',
    '--bach-overlay-bg': 'rgba(250, 250, 250, 0.85)',
    '--bach-overlay-blur': '8px',
    '--bach-font-size': '13px',
  },
};

export default minimalTheme;
