import type { ThemeManifest } from '@bach/core';
import { type ConductManifestFrame, canonicalManifest, encodeFrame } from './protocol.js';
import { type SubtleLike, signManifest } from './signing.js';

/**
 * Broadcaster-side SDK. The director SPA (apps/director, Sprint 32)
 * wraps this; raw consumers can also use it from a Node script.
 *
 * Lifecycle: build with an Ed25519 sign key + a sender. Each call to
 * `push(manifest)` signs the manifest, packages it into a v1 frame
 * with a monotonic sequence number, and hands it to the sender.
 *
 * Sender is intentionally an abstract callback (rather than the SDK
 * owning a WebSocket) so consumers can pipe through their relay's
 * favoured transport — WebSocket, SSE, gRPC, even a Cloudflare
 * Durable Object's WebSocketPair.
 */
export interface ConductBroadcaster {
  push(manifest: ThemeManifest): Promise<ConductManifestFrame>;
  /** The next sequence number that will be assigned. Useful for resume. */
  readonly nextSeq: number;
}

export type BroadcasterSender = (payload: string, frame: ConductManifestFrame) => void;

export interface BroadcasterOptions {
  /** Imported Ed25519 sign key (private). */
  signKey: CryptoKey;
  /** Callback that delivers the encoded frame to a transport. */
  send: BroadcasterSender;
  /** SubtleCrypto override for tests / polyfilled environments. */
  subtle?: SubtleLike;
  /** Starting sequence number. Defaults to 0; pass last+1 to resume. */
  startSeq?: number;
  /** Clock for the `ts` field. Defaults to Date.now. */
  now?: () => number;
}

export function createConductBroadcaster(opts: BroadcasterOptions): ConductBroadcaster {
  let seq = opts.startSeq ?? 0;
  const now = opts.now ?? (() => Date.now());

  return {
    get nextSeq() {
      return seq;
    },

    async push(manifest) {
      const canonical = canonicalManifest(manifest);
      const signature = await signManifest(canonical, opts.signKey, opts.subtle);
      const frame: ConductManifestFrame = {
        type: 'manifest',
        seq,
        ts: now(),
        signature,
        manifest,
      };
      seq += 1;
      opts.send(encodeFrame(frame), frame);
      return frame;
    },
  };
}
