import { describe, expect, it } from 'vitest';
import { canonicalManifest, decodeFrame, encodeFrame } from './protocol.js';

describe('decodeFrame', () => {
  it('parses a JSON string into a typed frame', () => {
    const frame = decodeFrame('{"type":"ping","ts":42}');
    expect(frame?.type).toBe('ping');
  });

  it('accepts pre-parsed objects', () => {
    expect(decodeFrame({ type: 'pong', ts: 1, echo: 0 })?.type).toBe('pong');
  });

  it('returns null for malformed JSON', () => {
    expect(decodeFrame('not-json')).toBeNull();
  });

  it('returns null for missing or unknown type', () => {
    expect(decodeFrame('{}')).toBeNull();
    expect(decodeFrame('{"type":"unknown"}')).toBeNull();
  });

  it('returns null for non-object payloads', () => {
    expect(decodeFrame(null)).toBeNull();
    expect(decodeFrame(42)).toBeNull();
  });
});

describe('encodeFrame', () => {
  it('round-trips through decodeFrame', () => {
    const original = { type: 'ping', ts: 7 } as const;
    expect(decodeFrame(encodeFrame(original))).toEqual(original);
  });
});

describe('canonicalManifest', () => {
  it('produces identical strings regardless of property order', () => {
    const a = canonicalManifest({ version: 1, cssVariables: { '--bach-color-bg': '#000' } });
    const b = canonicalManifest({
      cssVariables: { '--bach-color-bg': '#000' },
      version: 1,
    } as never);
    expect(a).toBe(b);
  });

  it('sorts nested object keys deterministically', () => {
    const out = canonicalManifest({
      version: 1,
      cssVariables: {
        '--bach-color-fg': '#fff',
        '--bach-color-bg': '#000',
      },
    });
    expect(out).toBe(
      '{"cssVariables":{"--bach-color-bg":"#000","--bach-color-fg":"#fff"},"version":1}',
    );
  });
});
