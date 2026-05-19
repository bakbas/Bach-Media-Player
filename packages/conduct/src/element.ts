import type { BachPlayerElement } from '@bach/core';
import { base64UrlDecode, importVerifyKey } from './signing.js';
import { type Viewer, createConductViewer } from './viewer.js';

/**
 * `<bach-conduct channel="wss://..." verify-key="base64url-public-key">` —
 * declarative entry point for the live director surface.
 *
 * On connect:
 *   1. Decode the `verify-key` attribute (URL-safe base64, raw 32-byte
 *      Ed25519 public key).
 *   2. Open a `WebSocket` to `channel`.
 *   3. Hand both to `createConductViewer`, with the closest
 *      `<bach-player>` as the apply-theme target.
 *
 * The element is non-visual; it sits inside the player as a logical
 * subscriber. Consumers can listen for `bach:conduct-applied` and
 * `bach:conduct-rejected` events for telemetry / on-screen badges.
 */
export class BachConductElement extends HTMLElement {
  static get observedAttributes(): readonly string[] {
    return ['channel', 'verify-key'];
  }

  #viewer: Viewer | null = null;
  #socket: WebSocket | null = null;

  get viewer(): Viewer | null {
    return this.#viewer;
  }

  connectedCallback(): void {
    void this.#start();
  }

  disconnectedCallback(): void {
    this.#stop();
  }

  attributeChangedCallback(): void {
    if (!this.isConnected) return;
    this.#stop();
    void this.#start();
  }

  async #start(): Promise<void> {
    const channel = this.getAttribute('channel');
    const verifyKeyAttr = this.getAttribute('verify-key');
    if (!channel || !verifyKeyAttr) return;
    if (typeof WebSocket === 'undefined') return;

    const keyBytes = base64UrlDecode(verifyKeyAttr);
    if (!keyBytes) {
      this.dispatchEvent(
        new CustomEvent('bach:conduct-rejected', {
          bubbles: true,
          composed: true,
          detail: { reason: 'invalid-verify-key' },
        }),
      );
      return;
    }
    let verifyKey: CryptoKey;
    try {
      verifyKey = await importVerifyKey(keyBytes);
    } catch {
      this.dispatchEvent(
        new CustomEvent('bach:conduct-rejected', {
          bubbles: true,
          composed: true,
          detail: { reason: 'verify-key-import-failed' },
        }),
      );
      return;
    }

    const host = this.closest<BachPlayerElement>('bach-player');
    if (!host) return;

    this.#socket = new WebSocket(channel);
    this.#viewer = createConductViewer({
      transport: this.#socket as unknown as Parameters<typeof createConductViewer>[0]['transport'],
      host,
      verifyKey,
      onApply: (result, frame) => {
        this.dispatchEvent(
          new CustomEvent('bach:conduct-applied', {
            bubbles: true,
            composed: true,
            detail: { result, frame },
          }),
        );
      },
      onReject: (reason, frame) => {
        this.dispatchEvent(
          new CustomEvent('bach:conduct-rejected', {
            bubbles: true,
            composed: true,
            detail: { reason, frame },
          }),
        );
      },
    });
  }

  #stop(): void {
    this.#viewer?.close();
    this.#viewer = null;
    this.#socket = null;
  }
}
