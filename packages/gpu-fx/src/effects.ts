/**
 * Effect descriptors. The pipeline consumes a `ReadonlyArray<Effect>`
 * and renders one pass per descriptor in order. Descriptors are plain
 * data so consumers can serialise them, send them through `applyTheme`
 * (Phase 5 conducting), or hand-craft them in tests.
 *
 * Every shader's WGSL source lives in `./shaders/*.ts`. The runtime
 * picks the source by `Effect.type` so the union here doubles as the
 * registry of available passes.
 */

export type Effect =
  | ColorGradeEffect
  | LutEffect
  | BlurRegionEffect
  | WatermarkEffect
  | FilmGrainEffect;

export type EffectType = Effect['type'];

export interface ColorGradeEffect {
  type: 'color-grade';
  /** Multiplicative gain applied after lift+gamma (default 1). */
  exposure?: number;
  /** Per-channel additive shift (default [0,0,0]). */
  lift?: [number, number, number];
  /** Per-channel gamma exponent (default [1,1,1]). */
  gamma?: [number, number, number];
  /** Per-channel multiplicative gain (default [1,1,1]). */
  gain?: [number, number, number];
  /** Saturation factor; 1 = identity, 0 = grayscale (default 1). */
  saturation?: number;
}

export interface LutEffect {
  type: 'lut';
  /**
   * Cube LUT loaded with `parseCubeLut`. The pipeline uploads it as a
   * 3D texture and samples it once per pixel.
   */
  cube: import('./lut.js').CubeLut;
  /** 0 = bypass, 1 = full LUT (default 1). */
  intensity?: number;
}

export interface BlurRegionEffect {
  type: 'blur-region';
  /** Normalised region in [0,1] coordinates. */
  region: { x: number; y: number; width: number; height: number };
  /** Pixels per blur kernel sample (default 8). */
  radius?: number;
}

export interface WatermarkEffect {
  type: 'watermark';
  /** Image source. Anything the GPU adapter can upload (Bitmap / ImageData / canvas). */
  image: unknown;
  /** Bottom-right by default. Normalised [0,1] coordinates. */
  position?: { x: number; y: number };
  /** Watermark scale relative to the canvas height (default 0.1). */
  scale?: number;
  /** Opacity 0..1 (default 0.8). */
  opacity?: number;
}

export interface FilmGrainEffect {
  type: 'film-grain';
  /** Grain intensity 0..1 (default 0.05). */
  amount?: number;
  /** Pseudo-random seed; defaults to performance.now() at attach time. */
  seed?: number;
}

/**
 * Normalise an effect chain. Pure helper:
 * - drops `null`/`undefined` entries (handy when toggling effects),
 * - strips unknown effect types so a hostile theme manifest cannot
 *   inject something the pipeline has no source for.
 *
 * The returned array is shallow-copied; callers can store it without
 * worrying about aliasing.
 */
export function normaliseChain(effects: ReadonlyArray<Effect | null | undefined>): Effect[] {
  const out: Effect[] = [];
  for (const fx of effects) {
    if (!fx) continue;
    if (!isKnownEffect(fx)) continue;
    out.push(fx);
  }
  return out;
}

const KNOWN_TYPES: ReadonlySet<EffectType> = new Set<EffectType>([
  'color-grade',
  'lut',
  'blur-region',
  'watermark',
  'film-grain',
]);

export function isKnownEffect(fx: Effect): boolean {
  return KNOWN_TYPES.has(fx.type);
}

/**
 * Multiply two effect chains. Useful when a preset is composed of a
 * curated base + the user's overrides — `merge(preset, userChain)`
 * concatenates them and normalises in one pass.
 */
export function mergeChains(
  ...chains: ReadonlyArray<ReadonlyArray<Effect | null | undefined> | undefined>
): Effect[] {
  const flat: Array<Effect | null | undefined> = [];
  for (const chain of chains) {
    if (!chain) continue;
    for (const fx of chain) flat.push(fx);
  }
  return normaliseChain(flat);
}
