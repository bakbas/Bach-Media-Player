import { describe, expect, it, vi } from 'vitest';
import { createConductBroadcaster } from './broadcaster.js';
import { canonicalManifest, decodeFrame } from './protocol.js';
import { type SubtleLike, verifyManifest } from './signing.js';

function makeFakeSubtle(): SubtleLike {
  const checksum = (bytes: Uint8Array): Uint8Array => {
    const out = new Uint8Array(32);
    let acc = 1;
    for (let i = 0; i < bytes.length; i += 1) {
      acc = (acc * 31 + (bytes[i] ?? 0)) >>> 0;
      out[i % 32] = (out[i % 32] ?? 0) ^ (acc & 0xff & 0xff);
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
      return checksum(view).buffer as ArrayBuffer;
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

describe('createConductBroadcaster', () => {
  it('signs and delivers a manifest as a v1 frame', async () => {
    const subtle = makeFakeSubtle();
    const send = vi.fn();
    const broadcaster = createConductBroadcaster({
      signKey: {} as CryptoKey,
      send,
      subtle,
      now: () => 1700000000000,
    });

    const frame = await broadcaster.push({ version: 1, cssVariables: { '--bach-radius': '12px' } });
    expect(frame.type).toBe('manifest');
    expect(frame.seq).toBe(0);
    expect(frame.ts).toBe(1700000000000);
    expect(send).toHaveBeenCalledTimes(1);

    // The sender receives the canonical-encoded payload.
    const payload = send.mock.calls[0]?.[0] as string;
    const decoded = decodeFrame(payload);
    expect(decoded?.type).toBe('manifest');
  });

  it('assigns monotonic sequence numbers', async () => {
    const subtle = makeFakeSubtle();
    const broadcaster = createConductBroadcaster({
      signKey: {} as CryptoKey,
      send: () => {},
      subtle,
    });
    const a = await broadcaster.push({ version: 1 });
    const b = await broadcaster.push({ version: 1 });
    const c = await broadcaster.push({ version: 1 });
    expect([a.seq, b.seq, c.seq]).toEqual([0, 1, 2]);
    expect(broadcaster.nextSeq).toBe(3);
  });

  it('honours startSeq for resume', async () => {
    const subtle = makeFakeSubtle();
    const broadcaster = createConductBroadcaster({
      signKey: {} as CryptoKey,
      send: () => {},
      subtle,
      startSeq: 42,
    });
    const frame = await broadcaster.push({ version: 1 });
    expect(frame.seq).toBe(42);
    expect(broadcaster.nextSeq).toBe(43);
  });

  it('produces a signature that round-trips through verifyManifest', async () => {
    const subtle = makeFakeSubtle();
    const broadcaster = createConductBroadcaster({
      signKey: {} as CryptoKey,
      send: () => {},
      subtle,
    });
    const manifest = { version: 1, cssVariables: { '--bach-color-accent': '#f06' } } as const;
    const frame = await broadcaster.push(manifest);
    const ok = await verifyManifest(
      canonicalManifest(frame.manifest),
      frame.signature,
      {} as CryptoKey,
      subtle,
    );
    expect(ok).toBe(true);
  });
});
