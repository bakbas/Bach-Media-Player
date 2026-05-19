/**
 * `bach.conduct.v1` wire protocol.
 *
 * A connection from a viewer to a relay carries one of four frame types,
 * each a JSON object with a discriminated `type` field. Binary framing is
 * supported by the WebSocket layer; the payload is plain UTF-8 JSON so
 * tooling, log scraping, and the director SPA can all read it.
 *
 * Frames travel both directions:
 *   - relay → viewer: `manifest` (signed theme delta), `ping`, `error`
 *   - viewer → relay: `pong`, `subscribe`
 *
 * Manifests are signed end-to-end by the broadcaster with Ed25519 (see
 * `signing.ts`). The relay is untrusted — it cannot forge frames the
 * viewer's `verifyKey` will accept.
 */

import type { ThemeManifest } from '@bach/core';

export const CONDUCT_PROTOCOL_VERSION = 1 as const;

export interface ConductManifestFrame {
  type: 'manifest';
  /** Monotonic per-connection sequence number for ordering / dedupe. */
  seq: number;
  /** Sender's wall-clock timestamp (ms epoch) at sign time. */
  ts: number;
  /** Base64url-encoded Ed25519 signature over `canonicalManifest`. */
  signature: string;
  /** The theme manifest — same shape as `applyTheme()` accepts in @bach/core. */
  manifest: ThemeManifest;
}

export interface ConductPingFrame {
  type: 'ping';
  ts: number;
}

export interface ConductPongFrame {
  type: 'pong';
  ts: number;
  /** Echoed `ts` from the matching ping. */
  echo: number;
}

export interface ConductErrorFrame {
  type: 'error';
  code: string;
  message: string;
}

export interface ConductSubscribeFrame {
  type: 'subscribe';
  /** Channel id the viewer is joining. */
  channel: string;
  /** Optional last-seen sequence number for resume. */
  resumeAt?: number;
}

export type ConductFrame =
  | ConductManifestFrame
  | ConductPingFrame
  | ConductPongFrame
  | ConductErrorFrame
  | ConductSubscribeFrame;

const KNOWN_TYPES: ReadonlySet<ConductFrame['type']> = new Set([
  'manifest',
  'ping',
  'pong',
  'error',
  'subscribe',
]);

/**
 * Decode a wire payload. Returns `null` for anything that does not match
 * the union — the viewer should silently drop unknown frames so future
 * protocol versions can add types without crashing v1 clients.
 */
export function decodeFrame(payload: string | unknown): ConductFrame | null {
  let parsed: unknown;
  if (typeof payload === 'string') {
    try {
      parsed = JSON.parse(payload);
    } catch {
      return null;
    }
  } else {
    parsed = payload;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as { type?: unknown };
  if (typeof obj.type !== 'string' || !KNOWN_TYPES.has(obj.type as ConductFrame['type'])) {
    return null;
  }
  return parsed as ConductFrame;
}

export function encodeFrame(frame: ConductFrame): string {
  return JSON.stringify(frame);
}

/**
 * Canonical JSON form of a manifest, used as the signing input. The
 * broadcaster signs this string; the viewer recomputes it before
 * verifying. Sorting keys deterministically so two equivalent JSON
 * encodings — one with `{cssVariables:..., version:1}` and one with
 * `{version:1, cssVariables:...}` — produce the same signature.
 */
export function canonicalManifest(manifest: ThemeManifest): string {
  return JSON.stringify(manifest, sortedKeys);
}

function sortedKeys(_key: string, value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const out: Record<string, unknown> = {};
  for (const [k, v] of entries) out[k] = v;
  return out;
}
