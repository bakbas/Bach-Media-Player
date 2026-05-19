/**
 * Ed25519 signing for `bach.conduct.v1` manifests. Built on Web Crypto
 * `SubtleCrypto` — every modern browser ships Ed25519 (Chrome 113+,
 * Safari 17+, Firefox 130+). For older runtimes the caller can polyfill
 * by passing their own implementation through the `SubtleLike` shim.
 *
 * Keys are imported and exported as raw bytes; the JSON encodings used
 * in the protocol are base64url so they survive WebSocket text frames.
 */

export interface SubtleLike {
  importKey(
    format: 'raw',
    keyData: BufferSource,
    algorithm: { name: 'Ed25519' },
    extractable: boolean,
    usages: ReadonlyArray<KeyUsage>,
  ): Promise<CryptoKey>;
  sign(algorithm: { name: 'Ed25519' }, key: CryptoKey, data: BufferSource): Promise<ArrayBuffer>;
  verify(
    algorithm: { name: 'Ed25519' },
    key: CryptoKey,
    signature: BufferSource,
    data: BufferSource,
  ): Promise<boolean>;
  generateKey(
    algorithm: { name: 'Ed25519' },
    extractable: boolean,
    usages: ReadonlyArray<KeyUsage>,
  ): Promise<CryptoKeyPair>;
  exportKey(format: 'raw', key: CryptoKey): Promise<ArrayBuffer>;
}

function defaultSubtle(): SubtleLike {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Bach conduct: SubtleCrypto unavailable — pass a SubtleLike shim');
  }
  return crypto.subtle as unknown as SubtleLike;
}

const ED25519 = { name: 'Ed25519' } as const;

const ENCODER = new TextEncoder();

/** UTF-8 encode the canonical manifest string for signing. */
export function manifestBytes(canonical: string): Uint8Array {
  return ENCODER.encode(canonical);
}

export async function importVerifyKey(
  rawPublicKey: BufferSource,
  subtle: SubtleLike = defaultSubtle(),
): Promise<CryptoKey> {
  return subtle.importKey('raw', rawPublicKey, ED25519, true, ['verify']);
}

export async function importSignKey(
  rawPrivateKey: BufferSource,
  subtle: SubtleLike = defaultSubtle(),
): Promise<CryptoKey> {
  return subtle.importKey('raw', rawPrivateKey, ED25519, true, ['sign']);
}

export async function generateKeyPair(
  subtle: SubtleLike = defaultSubtle(),
): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
  const pair = await subtle.generateKey(ED25519, true, ['sign', 'verify']);
  return { publicKey: pair.publicKey, privateKey: pair.privateKey };
}

export async function signManifest(
  canonical: string,
  signKey: CryptoKey,
  subtle: SubtleLike = defaultSubtle(),
): Promise<string> {
  const bytes = manifestBytes(canonical);
  const signature = await subtle.sign(ED25519, signKey, bytes);
  return base64UrlEncode(new Uint8Array(signature));
}

export async function verifyManifest(
  canonical: string,
  signatureBase64Url: string,
  verifyKey: CryptoKey,
  subtle: SubtleLike = defaultSubtle(),
): Promise<boolean> {
  const signature = base64UrlDecode(signatureBase64Url);
  if (!signature) return false;
  const bytes = manifestBytes(canonical);
  try {
    return await subtle.verify(ED25519, verifyKey, signature, bytes);
  } catch {
    return false;
  }
}

/**
 * Encode a byte sequence with the URL-safe base64 alphabet, no padding.
 * Exported because the director SPA needs to render the public key in
 * URLs and `<bach-conduct verify-key>` attributes.
 */
export function base64UrlEncode(bytes: Uint8Array): string {
  if (typeof btoa !== 'function') {
    throw new Error(
      'Bach conduct: btoa unavailable — base64 encoding requires a browser-like global',
    );
  }
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i] ?? 0);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlDecode(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  if (typeof atob !== 'function') return null;
  const padded =
    text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  try {
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}
