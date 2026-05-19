import type { ApplyThemeResult } from '@bach/core';
import { createRateLimiter, createSequenceGuard } from './guards.js';
import {
  type ConductFrame,
  type ConductManifestFrame,
  canonicalManifest,
  decodeFrame,
} from './protocol.js';
import { type SubtleLike, verifyManifest } from './signing.js';

/**
 * Viewer-side controller. Connects to a relay, decodes incoming
 * frames, verifies each manifest's Ed25519 signature against the
 * configured public key, runs the rate-limit + sequence guards, and
 * delegates to the host's `applyTheme()` for the actual DOM mutation.
 *
 * The controller is transport-agnostic: it accepts a `WebSocketLike`
 * surface so consumers can pass a mock or an SSE adapter.
 */

export interface WebSocketLike {
  addEventListener(type: 'message', handler: (event: { data: unknown }) => void): void;
  addEventListener(type: 'open' | 'close', handler: () => void): void;
  removeEventListener(type: string, handler: (event?: unknown) => void): void;
  send?(payload: string): void;
  close(): void;
}

export interface HostLike {
  /** Hand-off point. The conducted manifest is passed straight to applyTheme. */
  applyTheme(manifest: unknown): ApplyThemeResult;
}

export interface ViewerOptions {
  /** Open WebSocket-like transport. The viewer takes ownership of close(). */
  transport: WebSocketLike;
  /** Host player whose `applyTheme` will receive verified manifests. */
  host: HostLike;
  /** Imported Ed25519 public key the broadcaster signs with. */
  verifyKey: CryptoKey;
  /** SubtleCrypto override for tests / polyfilled environments. */
  subtle?: SubtleLike;
  /** Rate limit budget (manifests per second). Defaults to 10. */
  perSecond?: number;
  /** Optional resume sequence for reconnect. */
  resumeAt?: number;
  /** Called for every frame the viewer rejected, with a code. */
  onReject?: (reason: ViewerRejectReason, frame: ConductFrame | null) => void;
  /** Called after every accepted manifest, with the applyTheme result. */
  onApply?: (result: ApplyThemeResult, frame: ConductManifestFrame) => void;
}

export type ViewerRejectReason =
  | 'malformed'
  | 'unknown-frame'
  | 'bad-signature'
  | 'replay'
  | 'rate-limited'
  | 'apply-failed';

export interface Viewer {
  close(): void;
  readonly accepted: number;
  readonly rejected: number;
}

export function createConductViewer(opts: ViewerOptions): Viewer {
  const rate = createRateLimiter({ perSecond: opts.perSecond ?? 10 });
  const sequence = createSequenceGuard({ initial: opts.resumeAt ?? -1 });
  let accepted = 0;
  let rejected = 0;

  const reject = (reason: ViewerRejectReason, frame: ConductFrame | null): void => {
    rejected += 1;
    opts.onReject?.(reason, frame);
  };

  const onMessage = async (event: { data: unknown }): Promise<void> => {
    const frame = decodeFrame(event.data);
    if (!frame) {
      reject('malformed', null);
      return;
    }
    if (frame.type !== 'manifest') return;
    await handleManifest(frame);
  };

  const handleManifest = async (frame: ConductManifestFrame): Promise<void> => {
    if (!sequence.accept(frame.seq)) {
      reject('replay', frame);
      return;
    }
    if (!rate.allow()) {
      reject('rate-limited', frame);
      return;
    }
    const canonical = canonicalManifest(frame.manifest);
    const ok = await verifyManifest(canonical, frame.signature, opts.verifyKey, opts.subtle);
    if (!ok) {
      reject('bad-signature', frame);
      return;
    }
    let result: ApplyThemeResult;
    try {
      result = opts.host.applyTheme(frame.manifest);
    } catch {
      reject('apply-failed', frame);
      return;
    }
    accepted += 1;
    opts.onApply?.(result, frame);
  };

  opts.transport.addEventListener('message', (event) => {
    void onMessage(event);
  });

  return {
    close() {
      opts.transport.close();
      rate.reset();
    },
    get accepted() {
      return accepted;
    },
    get rejected() {
      return rejected;
    },
  };
}
