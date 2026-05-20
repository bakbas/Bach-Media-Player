import type { ThemeManifest } from '@bach/core';
import { broadcastTheme } from './broadcast.js';
import { cinematicTheme } from './cinematic.js';
import { minimalTheme } from './minimal.js';
import { terminalTheme } from './terminal.js';
import { vintageTheme } from './vintage.js';

/**
 * Bundled theme registry. Each entry is a fully-validated
 * `ThemeManifest` and shipped both as a subpath export and through
 * this map. Consumers that only need one preset should import the
 * subpath directly (`@bach/themes/cinematic`) so tree-shake drops the
 * rest.
 */
export const BACH_THEMES = {
  minimal: minimalTheme,
  cinematic: cinematicTheme,
  broadcast: broadcastTheme,
  terminal: terminalTheme,
  vintage: vintageTheme,
} as const satisfies Record<string, ThemeManifest>;

export type BachThemeName = keyof typeof BACH_THEMES;

export const BACH_THEME_NAMES: ReadonlyArray<BachThemeName> = Object.freeze(
  Object.keys(BACH_THEMES) as BachThemeName[],
);

/** Look up a preset by name. Returns `null` for unknown names. */
export function getBachTheme(name: string): ThemeManifest | null {
  return Object.hasOwn(BACH_THEMES, name) ? BACH_THEMES[name as BachThemeName] : null;
}

export { broadcastTheme, cinematicTheme, minimalTheme, terminalTheme, vintageTheme };
