export const CSS_VARIABLE_TOKENS = {
  '--bach-color-bg': { type: 'color', description: 'Player chrome background.' },
  '--bach-color-fg': { type: 'color', description: 'Primary foreground / icon colour.' },
  '--bach-color-accent': {
    type: 'color',
    description: 'Brand accent. Drives progress fill, focus rings, active states.',
  },
  '--bach-color-muted': { type: 'color', description: 'Secondary text and inactive icons.' },
  '--bach-radius': {
    type: 'length',
    description: 'Corner radius shared by buttons, chips, panels.',
  },
  '--bach-control-size': {
    type: 'length',
    description: 'Hit-target edge length for tappable controls.',
  },
  '--bach-control-gap': {
    type: 'length',
    description: 'Gap between adjacent controls in the chrome.',
  },
  '--bach-progress-track': { type: 'color', description: 'Progress bar track (unfilled portion).' },
  '--bach-progress-fill': { type: 'color', description: 'Progress bar fill (played portion).' },
  '--bach-progress-buffer': { type: 'color', description: 'Progress bar buffered indicator.' },
  '--bach-font-family': { type: 'font-family', description: 'Player typography stack.' },
  '--bach-font-size': {
    type: 'length',
    description: 'Base font size for time displays and labels.',
  },
  '--bach-overlay-bg': {
    type: 'color',
    description: 'Translucent overlay background (loading, error, menus).',
  },
  '--bach-overlay-blur': {
    type: 'length',
    description: 'Backdrop-filter blur radius for overlays.',
  },
} as const;

export type BachCssVariable = keyof typeof CSS_VARIABLE_TOKENS;

export const PART_NAMES = [
  'chrome',
  'play-button',
  'pause-button',
  'progress-bar',
  'progress-thumb',
  'timeline',
  'volume-slider',
  'volume-button',
  'caption-overlay',
  'caption-cue',
  'settings-menu',
  'fullscreen-button',
  'pip-button',
  'time-display',
] as const;

export type BachPartName = (typeof PART_NAMES)[number];
