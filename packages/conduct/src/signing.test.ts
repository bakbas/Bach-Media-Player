import { describe, expect, it, vi } from 'vitest';
import {
  type SubtleLike,
  base64UrlDecode,
  base64UrlEncode,
  signManifest,
  verifyManifest,
} from './signing.js';

/**
 * A fake "Ed25519" that signs by returning the payload's SHA-256-ish
 * checksum and verifies by recomputing. Enough fidelity to test the
 * round-trip, encoding paths, and the regression cases (bad signature,
 * tampered manifest) without depending on a real Subtle implementation.
 */
function makeFakeSubtle(): SubtleLike {
  const checksum = (bytes: Uint8Array): Uint8Array => {
    const out = new Uint8Array(32);
    let acc = 1;
    for (let i = 0; i < bytes.length; i += 1) {
      acc = (acc * 31 + (bytes[i] ?? 0)) >>> 0;
      out[i % 32] = (out[i % 32]! ^ (acc & 0xff)) & 0xff;
    }
    return out;
  };
  return {
    async importKey() {
      return {} as CryptoKey;
    },
    async generateKey() {
      return { publicKey: {} as CryptoKey, privateKey: {} as CryptoKey };
    },
    async sign(_alg, _key, data) {
      const view = new Uint8Array(
        data instanceof ArrayBuffer ? data : (data as ArrayBufferView).buffer,
      );
      return checksum(view).buffer;
    },
    async verify(_alg, _key, signature, data) {
      const sigBytes = new Uint8Array(
        signature instanceof ArrayBuffer ? signature : (signature as ArrayBufferView).buffer,
      );
      const dataBytes = new Uint8Array(
        data instanceof ArrayBuffer ? data : (data as ArrayBufferView).buffer,
      );
      const expected = checksum(dataBytes);
      if (sigBytes.length !== expected.length) return false;
      for (let i = 0; i < expected.length; i += 1) {
        if (sigBytes[i] !== expected[i]) return false;
      }
      return true;
    },
    async exportKey() {
      return new ArrayBuffer(32);
    },
  };
}

describe('base64UrlEncode / base64UrlDecode', () => {
  it('round-trips byte sequences', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    const encoded = base64UrlEncode(bytes);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toMatch(/=+$/);
    const decoded = base64UrlDecode(encoded);
    expect(Array.from(decoded ?? [])).toEqual(Array.from(bytes));
  });

  it('returns null for malformed input', () => {
    expect(base64UrlDecode('not!base64')).toBeNull();
  });
});

describe('signManifest / verifyManifest', () => {
  it('signs and verifies the same payload', async () => {
    const subtle = makeFakeSubtle();
    const canonical = '{"version":1}';
    const signKey = {} as CryptoKey;
    const verifyKey = {} as CryptoKey;
    const sig = await signManifest(canonical, signKey, subtle);
    expect(await verifyManifest(canonical, sig, verifyKey, subtle)).toBe(true);
  });

  it('rejects a tampered manifest', async () => {
    const subtle = makeFakeSubtle();
    const signKey = {} as CryptoKey;
    const verifyKey = {} as CryptoKey;
    const sig = await signManifest('{"version":1}', signKey, subtle);
    expect(await verifyManifest('{"version":1,"extra":true}', sig, verifyKey, subtle)).toBe(false);
  });

  it('rejects a malformed signature string', async () => {
    const subtle = makeFakeSubtle();
    expect(await verifyManifest('{"version":1}', 'not-base64!', {} as CryptoKey, subtle)).toBe(
      false,
    );
  });

  it('rejects when subtle.verify throws', async () => {
    const subtle = makeFakeSubtle();
    subtle.verify = vi.fn(async () => {
      throw new Error('crypto error');
    });
    const sig = base64UrlEncode(new Uint8Array(32));
    expect(await verifyManifest('{"version":1}', sig, {} as CryptoKey, subtle)).toBe(false);
  });
});
