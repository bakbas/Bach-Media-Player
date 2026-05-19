/**
 * `.cube` 3D LUT parser. Adobe / Resolve / most colour-grading tools
 * export to this format; the spec is dead simple:
 *
 *   # comment
 *   TITLE "name"
 *   LUT_3D_SIZE N
 *   DOMAIN_MIN r g b
 *   DOMAIN_MAX r g b
 *   <N³ lines of "r g b" floats>
 *
 * The parser returns the data ordered for direct upload to a WebGPU
 * `texture_3d<f32>` — fastest-varying axis is red, then green, then
 * blue, matching `texelLoad(t, vec3(r, g, b), 0)` semantics.
 */
export interface CubeLut {
  /** Size of one axis. The table contains `size³` RGB triplets. */
  size: number;
  /** Flat `size³ * 3` Float32 buffer (interleaved r, g, b). */
  data: Float32Array;
  /** Optional title from the file. */
  title?: string;
  /** Defaults to [0,0,0] / [1,1,1]. */
  domainMin: [number, number, number];
  domainMax: [number, number, number];
}

const HEADER_TITLE = /^TITLE\s+"?([^"]+)"?$/i;
const HEADER_SIZE = /^LUT_3D_SIZE\s+(\d+)$/i;
const HEADER_DOMAIN_MIN = /^DOMAIN_MIN\s+(\S+)\s+(\S+)\s+(\S+)$/i;
const HEADER_DOMAIN_MAX = /^DOMAIN_MAX\s+(\S+)\s+(\S+)\s+(\S+)$/i;
const TRIPLET = /^(\S+)\s+(\S+)\s+(\S+)$/;

/**
 * Parse a `.cube` file string into a `CubeLut`. Throws when the file
 * is malformed (missing size, wrong sample count, non-numeric triplet)
 * — the GPU pipeline must reject bad LUTs before allocating texture
 * memory, so loud failure here is intentional.
 */
export function parseCubeLut(source: string): CubeLut {
  let size = 0;
  let title: string | undefined;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const samples: number[] = [];

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith('#')) continue;
    if (line.startsWith('LUT_1D_SIZE')) {
      throw new Error('Bach LUT: 1D LUTs are not supported (use LUT_3D_SIZE)');
    }

    let match: RegExpMatchArray | null;
    match = line.match(HEADER_SIZE);
    if (match) {
      size = Number.parseInt(match[1] ?? '0', 10);
      continue;
    }
    match = line.match(HEADER_TITLE);
    if (match) {
      title = match[1];
      continue;
    }
    match = line.match(HEADER_DOMAIN_MIN);
    if (match) {
      domainMin = [
        parseFloatStrict(match[1]),
        parseFloatStrict(match[2]),
        parseFloatStrict(match[3]),
      ];
      continue;
    }
    match = line.match(HEADER_DOMAIN_MAX);
    if (match) {
      domainMax = [
        parseFloatStrict(match[1]),
        parseFloatStrict(match[2]),
        parseFloatStrict(match[3]),
      ];
      continue;
    }
    match = line.match(TRIPLET);
    if (match) {
      samples.push(
        parseFloatStrict(match[1]),
        parseFloatStrict(match[2]),
        parseFloatStrict(match[3]),
      );
      continue;
    }
    throw new Error(`Bach LUT: unrecognised line "${line}"`);
  }

  if (size <= 1) {
    throw new Error('Bach LUT: LUT_3D_SIZE missing or smaller than 2');
  }
  const expected = size * size * size;
  if (samples.length !== expected * 3) {
    throw new Error(
      `Bach LUT: expected ${expected} triplets for size ${size}, found ${samples.length / 3}`,
    );
  }
  const data = new Float32Array(samples);
  const result: CubeLut = { size, data, domainMin, domainMax };
  if (title !== undefined) result.title = title;
  return result;
}

function parseFloatStrict(text: string | undefined): number {
  if (text === undefined) throw new Error('Bach LUT: missing numeric token');
  const value = Number.parseFloat(text);
  if (!Number.isFinite(value)) {
    throw new Error(`Bach LUT: not a finite number "${text}"`);
  }
  return value;
}

/**
 * Build an N=2 identity LUT — fastest path for "no grade" while still
 * exercising the shader, and useful as a fallback when a load fails.
 */
export function identityLut(size = 2): CubeLut {
  const n = Math.max(2, Math.floor(size));
  const data = new Float32Array(n * n * n * 3);
  const denom = n - 1;
  let cursor = 0;
  for (let b = 0; b < n; b += 1) {
    for (let g = 0; g < n; g += 1) {
      for (let r = 0; r < n; r += 1) {
        data[cursor] = r / denom;
        data[cursor + 1] = g / denom;
        data[cursor + 2] = b / denom;
        cursor += 3;
      }
    }
  }
  return { size: n, data, domainMin: [0, 0, 0], domainMax: [1, 1, 1] };
}
