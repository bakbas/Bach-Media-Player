/**
 * WGSL shader sources for every pass. Inlined as TypeScript exports
 * so consumers can serve them from any bundler without configuring a
 * loader. The runtime concatenates the shared vertex stage with the
 * per-effect fragment stage at attach time.
 *
 * Each fragment shader receives the input frame as
 * `texture_external` (preferred when `importExternalTexture` is
 * available, which is the zero-copy path) plus a per-effect uniform
 * block. Sampling for external textures uses a separate sampler the
 * pipeline owns.
 */

/**
 * Fullscreen triangle vertex stage. Same source for every pass; the
 * fragment shader picks up `uv` and reads the external texture.
 */
export const FULLSCREEN_VERT = /* wgsl */ `
struct VsOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) i: u32) -> VsOut {
  // Single triangle covering NDC, oversized so the vertex order is
  // independent of culling state.
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -3.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 3.0,  1.0),
  );
  var uvs = array<vec2<f32>, 3>(
    vec2<f32>(0.0, 2.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(2.0, 0.0),
  );
  var out: VsOut;
  out.position = vec4<f32>(positions[i], 0.0, 1.0);
  out.uv = uvs[i];
  return out;
}
`;

/**
 * Color grade: lift / gamma / gain + exposure + 3x3 saturation matrix.
 * The uniform layout matches `ColorGradeUniforms` exactly so the
 * runtime can `memcpy` straight in.
 */
export const COLOR_GRADE_FRAG = /* wgsl */ `
struct Uniforms {
  exposure: f32,
  _pad0: vec3<f32>,
  lift: vec3<f32>,
  _pad1: f32,
  gamma: vec3<f32>,
  _pad2: f32,
  gain: vec3<f32>,
  _pad3: f32,
  sat: mat3x3<f32>,
};

@group(0) @binding(0) var src: texture_external;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var<uniform> u: Uniforms;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let color = textureSampleBaseClampToEdge(src, samp, uv);
  let lifted = color.rgb + u.lift;
  let gammaCorrected = pow(max(lifted, vec3<f32>(0.0)), vec3<f32>(1.0) / u.gamma);
  let scaled = gammaCorrected * u.gain * u.exposure;
  let graded = u.sat * scaled;
  return vec4<f32>(clamp(graded, vec3<f32>(0.0), vec3<f32>(1.0)), color.a);
}
`;

/**
 * 3D LUT lookup. `intensity` lerps the original sample with the LUT
 * output so consumers can blend the grade.
 */
export const LUT_FRAG = /* wgsl */ `
struct Uniforms {
  intensity: f32,
  _pad: vec3<f32>,
};

@group(0) @binding(0) var src: texture_external;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var lut: texture_3d<f32>;
@group(0) @binding(3) var lutSamp: sampler;
@group(0) @binding(4) var<uniform> u: Uniforms;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let color = textureSampleBaseClampToEdge(src, samp, uv);
  let lookup = textureSample(lut, lutSamp, color.rgb).rgb;
  return vec4<f32>(mix(color.rgb, lookup, u.intensity), color.a);
}
`;

/**
 * Region blur — separable Gaussian collapsed into a single pass for
 * the small kernel sizes we use (radius ≤ 16). Pixels outside the
 * declared rectangle are returned unmodified.
 */
export const BLUR_REGION_FRAG = /* wgsl */ `
struct Uniforms {
  region: vec4<f32>,   // x, y, width, height in [0,1]
  radius: f32,         // pixels (sampled in normalised step size)
  _pad: vec3<f32>,
  invResolution: vec2<f32>,
  _pad2: vec2<f32>,
};

@group(0) @binding(0) var src: texture_external;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var<uniform> u: Uniforms;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let inside = step(u.region.x, uv.x) * step(uv.x, u.region.x + u.region.z)
             * step(u.region.y, uv.y) * step(uv.y, u.region.y + u.region.w);
  if (inside < 1.0) {
    return textureSampleBaseClampToEdge(src, samp, uv);
  }
  var acc = vec4<f32>(0.0);
  var weight = 0.0;
  let step_uv = u.invResolution * u.radius;
  for (var dy = -4; dy <= 4; dy = dy + 1) {
    for (var dx = -4; dx <= 4; dx = dx + 1) {
      let offset = vec2<f32>(f32(dx), f32(dy)) * step_uv;
      let w = exp(-(f32(dx * dx + dy * dy)) / 8.0);
      acc = acc + textureSampleBaseClampToEdge(src, samp, uv + offset) * w;
      weight = weight + w;
    }
  }
  return acc / weight;
}
`;

/**
 * Watermark composite. The watermark texture is bound at @1 and
 * positioned via uniforms; alpha-out blends with `opacity`.
 */
export const WATERMARK_FRAG = /* wgsl */ `
struct Uniforms {
  position: vec2<f32>,
  size: vec2<f32>,
  opacity: f32,
  _pad: vec3<f32>,
};

@group(0) @binding(0) var src: texture_external;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var watermark: texture_2d<f32>;
@group(0) @binding(3) var wmSamp: sampler;
@group(0) @binding(4) var<uniform> u: Uniforms;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let base = textureSampleBaseClampToEdge(src, samp, uv);
  let local = (uv - u.position) / u.size;
  let inside = step(0.0, local.x) * step(local.x, 1.0)
             * step(0.0, local.y) * step(local.y, 1.0);
  if (inside < 1.0) { return base; }
  let mark = textureSample(watermark, wmSamp, local);
  let alpha = mark.a * u.opacity;
  return vec4<f32>(mix(base.rgb, mark.rgb, alpha), base.a);
}
`;

/**
 * Film grain. Cheap hash-based noise — no expensive textures, no
 * banding. `seed` shifts the pattern between frames so static
 * inputs do not look texture-stuck.
 */
export const FILM_GRAIN_FRAG = /* wgsl */ `
struct Uniforms {
  amount: f32,
  seed: f32,
  _pad: vec2<f32>,
};

@group(0) @binding(0) var src: texture_external;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var<uniform> u: Uniforms;

fn hash21(p: vec2<f32>) -> f32 {
  let h = dot(p, vec2<f32>(127.1, 311.7));
  return fract(sin(h) * 43758.5453);
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let color = textureSampleBaseClampToEdge(src, samp, uv);
  let n = hash21(uv * 1024.0 + u.seed) - 0.5;
  return vec4<f32>(clamp(color.rgb + n * u.amount, vec3<f32>(0.0), vec3<f32>(1.0)), color.a);
}
`;

export const FRAGMENT_SHADERS = {
  'color-grade': COLOR_GRADE_FRAG,
  lut: LUT_FRAG,
  'blur-region': BLUR_REGION_FRAG,
  watermark: WATERMARK_FRAG,
  'film-grain': FILM_GRAIN_FRAG,
} as const;

export type ShaderKey = keyof typeof FRAGMENT_SHADERS;
