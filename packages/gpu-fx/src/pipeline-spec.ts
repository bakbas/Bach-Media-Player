import { type ColorGradeUniforms, colorGradeUniforms } from './color-grade.js';
import type { Effect } from './effects.js';
import { FRAGMENT_SHADERS, FULLSCREEN_VERT, type ShaderKey } from './shaders.js';

/**
 * Pipeline spec. A pure data structure that describes what the WebGPU
 * runtime needs to do per pass: which WGSL source to compile, what
 * uniform bytes to write, what auxiliary textures (LUT, watermark) to
 * bind. The runtime layer (Sprint 25b) walks this spec and translates
 * it into `device.createShaderModule()` / `device.createRenderPipeline()`
 * / `encoder.beginRenderPass()` calls.
 *
 * Keeping the spec pure means we can unit-test "did the chain produce
 * the expected GPU work?" without ever instantiating a real adapter.
 */

export interface PassSpec {
  /** Stable id for diffing across frames (so we can reuse compiled pipelines). */
  id: string;
  /** Effect type — picks the WGSL fragment source. */
  effectType: Effect['type'];
  /** WGSL vertex source. Shared `FULLSCREEN_VERT` for every pass today. */
  vertexSource: string;
  /** WGSL fragment source — looked up from `FRAGMENT_SHADERS`. */
  fragmentSource: string;
  /** Packed uniform bytes ready for `device.queue.writeBuffer`. */
  uniforms: Float32Array;
  /** Auxiliary textures the runtime must upload before the pass runs. */
  auxiliary: AuxiliaryResource[];
}

export type AuxiliaryResource =
  | { kind: 'lut3d'; cube: import('./lut.js').CubeLut }
  | { kind: 'watermark'; image: unknown };

export interface PipelineSpec {
  passes: ReadonlyArray<PassSpec>;
  /** Render output dimensions, used by passes that need `invResolution`. */
  resolution: { width: number; height: number };
}

export interface BuildPipelineSpecOptions {
  effects: ReadonlyArray<Effect>;
  resolution?: { width: number; height: number };
  /** Performance.now() at attach time — feeds the film-grain seed when omitted. */
  now?: () => number;
}

const DEFAULT_RESOLUTION = { width: 1920, height: 1080 };

function defaultNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/**
 * Translate an effect chain into the data the runtime needs. The result
 * is shallow-stable: rerunning with the same chain yields the same pass
 * ids so the runtime can reuse cached `GPURenderPipeline` objects.
 */
export function buildPipelineSpec(opts: BuildPipelineSpecOptions): PipelineSpec {
  const resolution = opts.resolution ?? DEFAULT_RESOLUTION;
  const now = opts.now ?? defaultNow;
  const passes: PassSpec[] = [];

  for (let i = 0; i < opts.effects.length; i += 1) {
    const effect = opts.effects[i];
    if (!effect) continue;
    const key = effect.type as ShaderKey;
    const fragmentSource = FRAGMENT_SHADERS[key];
    if (!fragmentSource) continue;
    passes.push({
      id: `${i}-${effect.type}`,
      effectType: effect.type,
      vertexSource: FULLSCREEN_VERT,
      fragmentSource,
      uniforms: packUniforms(effect, resolution, now),
      auxiliary: auxiliaryFor(effect),
    });
  }

  return { passes, resolution };
}

function packUniforms(
  effect: Effect,
  resolution: { width: number; height: number },
  now: () => number,
): Float32Array {
  switch (effect.type) {
    case 'color-grade':
      return packColorGrade(colorGradeUniforms(effect));
    case 'lut':
      return new Float32Array([clamp01(effect.intensity ?? 1), 0, 0, 0]);
    case 'blur-region': {
      const region = effect.region;
      const invW = resolution.width === 0 ? 0 : 1 / resolution.width;
      const invH = resolution.height === 0 ? 0 : 1 / resolution.height;
      return new Float32Array([
        region.x,
        region.y,
        region.width,
        region.height,
        Math.max(1, effect.radius ?? 8),
        0,
        0,
        0,
        invW,
        invH,
        0,
        0,
      ]);
    }
    case 'watermark': {
      const pos = effect.position ?? { x: 0.78, y: 0.82 };
      const scale = Math.max(0.01, effect.scale ?? 0.1);
      const aspect = resolution.height === 0 ? 1 : resolution.width / resolution.height;
      return new Float32Array([
        pos.x,
        pos.y,
        scale,
        scale * aspect,
        clamp01(effect.opacity ?? 0.8),
        0,
        0,
        0,
      ]);
    }
    case 'film-grain':
      return new Float32Array([clamp01(effect.amount ?? 0.05), effect.seed ?? now(), 0, 0]);
  }
}

function packColorGrade(u: ColorGradeUniforms): Float32Array {
  // Layout matches the WGSL struct in shaders.ts (with std140-style padding).
  const buffer = new Float32Array(28);
  buffer[0] = u.exposure;
  buffer[4] = u.lift[0];
  buffer[5] = u.lift[1];
  buffer[6] = u.lift[2];
  buffer[8] = u.gamma[0];
  buffer[9] = u.gamma[1];
  buffer[10] = u.gamma[2];
  buffer[12] = u.gain[0];
  buffer[13] = u.gain[1];
  buffer[14] = u.gain[2];
  for (let i = 0; i < 9; i += 1) buffer[16 + i] = u.saturationMatrix[i] ?? 0;
  return buffer;
}

function auxiliaryFor(effect: Effect): AuxiliaryResource[] {
  if (effect.type === 'lut') return [{ kind: 'lut3d', cube: effect.cube }];
  if (effect.type === 'watermark') return [{ kind: 'watermark', image: effect.image }];
  return [];
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
