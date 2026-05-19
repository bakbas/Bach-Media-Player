import type { Effect } from './effects.js';

/**
 * Curated effect chains. Each preset is a plain data structure so
 * consumers can `mergeChains(preset, userTweaks)` or hand the chain
 * straight into the pipeline.
 *
 * All numbers were dialled by ear — they look reasonable on the
 * playground's HLS test stream and avoid clipping. The mood targets
 * are: cinematic (teal/orange, mild grain), broadcast (neutral, slight
 * sharpening via lift+gain), vintage (warm cast, strong grain), and
 * minimal (touch of exposure for the dark UI test).
 */
export const PRESET_CINEMATIC: ReadonlyArray<Effect> = [
  {
    type: 'color-grade',
    exposure: 1.0,
    lift: [0.0, -0.01, -0.02],
    gamma: [1.0, 1.05, 1.1],
    gain: [1.05, 1.0, 0.92],
    saturation: 1.1,
  },
  { type: 'film-grain', amount: 0.04 },
];

export const PRESET_BROADCAST: ReadonlyArray<Effect> = [
  {
    type: 'color-grade',
    exposure: 1.02,
    lift: [0.005, 0.005, 0.005],
    gamma: [0.98, 0.98, 0.98],
    gain: [1.0, 1.0, 1.0],
    saturation: 0.95,
  },
];

export const PRESET_VINTAGE: ReadonlyArray<Effect> = [
  {
    type: 'color-grade',
    exposure: 0.95,
    lift: [0.03, 0.01, -0.02],
    gamma: [1.15, 1.05, 0.95],
    gain: [1.1, 1.0, 0.85],
    saturation: 0.8,
  },
  { type: 'film-grain', amount: 0.12 },
];

export const PRESET_MINIMAL: ReadonlyArray<Effect> = [
  {
    type: 'color-grade',
    exposure: 1.05,
    saturation: 1.0,
  },
];

export const PRESETS = {
  cinematic: PRESET_CINEMATIC,
  broadcast: PRESET_BROADCAST,
  vintage: PRESET_VINTAGE,
  minimal: PRESET_MINIMAL,
} as const;

export type PresetName = keyof typeof PRESETS;

export function getPreset(name: PresetName): ReadonlyArray<Effect> {
  return PRESETS[name];
}
