import type { ThemeManifest } from '@bach/core';

/**
 * Terminal — mono spaced, green-on-black phosphor look. The font-family
 * override is deliberately broad so the user's system mono font wins
 * before we fall back to Courier; the regex in the parser only accepts
 * commas, quotes and word characters so this stays valid.
 */
export const terminalTheme: ThemeManifest = {
  version: 1,
  layout: 'default',
  cssVariables: {
    '--bach-color-bg': '#001100',
    '--bach-color-fg': '#33ff33',
    '--bach-color-accent': '#66ff66',
    '--bach-color-muted': '#1f7a1f',
    '--bach-progress-track': 'rgba(51, 255, 51, 0.18)',
    '--bach-progress-fill': '#66ff66',
    '--bach-progress-buffer': 'rgba(102, 255, 102, 0.45)',
    '--bach-radius': '0px',
    '--bach-control-size': '32px',
    '--bach-control-gap': '4px',
    '--bach-overlay-bg': 'rgba(0, 17, 0, 0.92)',
    '--bach-overlay-blur': '0px',
    '--bach-font-family': '"JetBrains Mono", "Fira Code", Consolas, monospace',
    '--bach-font-size': '13px',
  },
};

export default terminalTheme;
