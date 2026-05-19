import { describe, expect, it } from 'vitest';
import { identityLut, parseCubeLut } from './lut.js';

const minimal = `# Bach test LUT
TITLE "demo"
LUT_3D_SIZE 2
DOMAIN_MIN 0 0 0
DOMAIN_MAX 1 1 1
0 0 0
1 0 0
0 1 0
1 1 0
0 0 1
1 0 1
0 1 1
1 1 1
`;

describe('parseCubeLut', () => {
  it('parses headers and samples', () => {
    const lut = parseCubeLut(minimal);
    expect(lut.size).toBe(2);
    expect(lut.title).toBe('demo');
    expect(lut.domainMin).toEqual([0, 0, 0]);
    expect(lut.domainMax).toEqual([1, 1, 1]);
    expect(lut.data.length).toBe(2 * 2 * 2 * 3);
  });

  it('ignores blank lines and comments', () => {
    const lut = parseCubeLut(`
# leading comment
LUT_3D_SIZE 2

# midway
0 0 0
# inline
1 0 0
0 1 0
1 1 0
0 0 1
1 0 1
0 1 1
1 1 1
`);
    expect(lut.size).toBe(2);
  });

  it('rejects 1D LUTs', () => {
    expect(() => parseCubeLut('LUT_1D_SIZE 4\n')).toThrow(/1D LUTs/);
  });

  it('rejects missing size', () => {
    expect(() => parseCubeLut('TITLE "x"\n0 0 0\n')).toThrow(/LUT_3D_SIZE/);
  });

  it('rejects wrong sample count', () => {
    expect(() => parseCubeLut('LUT_3D_SIZE 2\n0 0 0\n')).toThrow(/triplets/);
  });

  it('rejects non-finite numbers', () => {
    expect(() => parseCubeLut('LUT_3D_SIZE 2\nNaN 0 0\n')).toThrow();
  });

  it('rejects unrecognised lines', () => {
    expect(() => parseCubeLut('LUT_3D_SIZE 2\nfoo bar baz qux\n')).toThrow(/unrecognised/);
  });
});

describe('identityLut', () => {
  it('returns the identity grading for size N', () => {
    const lut = identityLut(3);
    expect(lut.size).toBe(3);
    expect(lut.data.length).toBe(3 * 3 * 3 * 3);
    // Origin sample is (0,0,0); the very last sample is (1,1,1).
    expect(lut.data[0]).toBe(0);
    expect(lut.data[1]).toBe(0);
    expect(lut.data[2]).toBe(0);
    const last = lut.data.length - 3;
    expect(lut.data[last]).toBe(1);
    expect(lut.data[last + 1]).toBe(1);
    expect(lut.data[last + 2]).toBe(1);
  });
  it('floors size to 2', () => {
    expect(identityLut(1).size).toBe(2);
    expect(identityLut(0).size).toBe(2);
  });
});
