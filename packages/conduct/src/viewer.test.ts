import type { ApplyThemeResult, ThemeManifest } from '@bach/core';
import { describe, expect, it, vi } from 'vitest';
import { canonicalManifest, encodeFrame } from './protocol.js';
import { type SubtleLike, signManifest } from './signing.js';
import { type WebSocketLike, createConductViewer } from './viewer.js';

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

function fakeTransport(): {
  transport: WebSocketLike;
  emit: (data: unknown) => void;
  closed: () => boolean;
} {
  let listeners: Array<(event: { data: unknown }) => void> = [];
  let closed = false;
  const transport: WebSocketLike = {
    addEventListener(type, handler) {
      if (type === 'message') listeners.push(handler as (e: { data: unknown }) => void);
    },
    removeEventListener(type, handler) {
      if (type === 'message') listeners = listeners.filter((h) => h !== handler);
    },
    close() {
      closed = true;
    },
  };
  return {
    transport,
    emit: (data) => {
      for (const h of listeners) h({ data });
    },
    closed: () => closed,
  };
}

function fakeHost(): {
  host: { applyTheme: (m: unknown) => ApplyThemeResult };
  spy: ReturnType<typeof vi.fn>;
} {
  const spy = vi.fn(
    (_m: unknown): ApplyThemeResult => ({ applied: {}, rejected: [], layout: null }),
  );
  return { host: { applyTheme: spy }, spy };
}

async function signedFrame(
  manifest: ThemeManifest,
  seq: number,
  subtle: SubtleLike,
): Promise<string> {
  const canonical = canonicalManifest(manifest);
  const signature = await signManifest(canonical, {} as CryptoKey, subtle);
  return encodeFrame({ type: 'manifest', seq, ts: Date.now(), signature, manifest });
}

describe('createConductViewer', () => {
  it('accepts a signed manifest and delegates to host.applyTheme', async () => {
    const subtle = makeFakeSubtle();
    const { transport, emit } = fakeTransport();
    const { host, spy } = fakeHost();
    const viewer = createConductViewer({
      transport,
      host,
      verifyKey: {} as CryptoKey,
      subtle,
    });
    const frame = await signedFrame({ version: 1 }, 0, subtle);
    emit(frame);
    await Promise.resolve();
    await Promise.resolve();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(viewer.accepted).toBe(1);
    expect(viewer.rejected).toBe(0);
  });

  it('rejects a tampered manifest (signature mismatch)', async () => {
    const subtle = makeFakeSubtle();
    const { transport, emit } = fakeTransport();
    const { host, spy } = fakeHost();
    const rejects: string[] = [];
    createConductViewer({
      transport,
      host,
      verifyKey: {} as CryptoKey,
      subtle,
      onReject: (reason) => rejects.push(reason),
    });
    const ok = await signedFrame({ version: 1 }, 0, subtle);
    const parsed = JSON.parse(ok) as { manifest: ThemeManifest };
    parsed.manifest = { version: 1, layout: 'cinematic' };
    emit(JSON.stringify(parsed));
    await Promise.resolve();
    await Promise.resolve();
    expect(spy).not.toHaveBeenCalled();
    expect(rejects).toContain('bad-signature');
  });

  it('drops replay (seq <= last)', async () => {
    const subtle = makeFakeSubtle();
    const { transport, emit } = fakeTransport();
    const { host, spy } = fakeHost();
    const rejects: string[] = [];
    createConductViewer({
      transport,
      host,
      verifyKey: {} as CryptoKey,
      subtle,
      onReject: (reason) => rejects.push(reason),
    });
    const a = await signedFrame({ version: 1 }, 5, subtle);
    const b = await signedFrame({ version: 1 }, 5, subtle);
    emit(a);
    emit(b);
    await Promise.resolve();
    await Promise.resolve();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(rejects).toContain('replay');
  });

  it('rate-limits manifest floods', async () => {
    const subtle = makeFakeSubtle();
    const { transport, emit } = fakeTransport();
    const { host, spy } = fakeHost();
    const rejects: string[] = [];
    createConductViewer({
      transport,
      host,
      verifyKey: {} as CryptoKey,
      subtle,
      perSecond: 2,
      onReject: (reason) => rejects.push(reason),
    });
    for (let i = 0; i < 5; i += 1) {
      emit(await signedFrame({ version: 1 }, i, subtle));
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    expect(spy).toHaveBeenCalledTimes(2);
    expect(rejects.filter((r) => r === 'rate-limited').length).toBeGreaterThanOrEqual(1);
  });

  it('drops malformed payloads', async () => {
    const subtle = makeFakeSubtle();
    const { transport, emit } = fakeTransport();
    const { host, spy } = fakeHost();
    const rejects: string[] = [];
    createConductViewer({
      transport,
      host,
      verifyKey: {} as CryptoKey,
      subtle,
      onReject: (reason) => rejects.push(reason),
    });
    emit('not-json');
    emit({ type: 'unknown' });
    await Promise.resolve();
    expect(spy).not.toHaveBeenCalled();
    expect(rejects).toContain('malformed');
  });

  it('close() releases the transport', () => {
    const { transport, closed } = fakeTransport();
    const { host } = fakeHost();
    const viewer = createConductViewer({
      transport,
      host,
      verifyKey: {} as CryptoKey,
      subtle: makeFakeSubtle(),
    });
    viewer.close();
    expect(closed()).toBe(true);
  });
});
