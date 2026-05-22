import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BachConductElement } from './element.js';

/**
 * Element-level smoke tests. We stub `WebSocket` and `crypto.subtle`
 * just enough to drive the connect / disconnect lifecycle and observe
 * the early-return rejections without standing up a real signed
 * conducting session.
 */

class FakeSocket extends EventTarget {
  readyState = 1;
  send = vi.fn();
  close = vi.fn();
  constructor(public url: string) {
    super();
  }
}

const captured: FakeSocket[] = [];

beforeEach(() => {
  captured.length = 0;
  Object.defineProperty(globalThis, 'WebSocket', {
    configurable: true,
    writable: true,
    value: class extends FakeSocket {
      constructor(url: string) {
        super(url);
        captured.push(this);
      }
    },
  });
  if (!customElements.get('bach-conduct')) {
    customElements.define('bach-conduct', BachConductElement);
  }
  if (!customElements.get('bach-player')) {
    customElements.define(
      'bach-player',
      class extends HTMLElement {
        applyTheme = vi.fn(() => ({ applied: {}, rejected: [], layout: null }));
      },
    );
  }
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('<bach-conduct>', () => {
  it('does nothing when channel or verify-key is missing', async () => {
    const el = document.createElement('bach-conduct') as BachConductElement;
    document.body.appendChild(el);
    await Promise.resolve();
    expect(el.viewer).toBeNull();
    expect(captured).toHaveLength(0);
  });

  it('rejects with reason "invalid-verify-key" when the attribute is malformed', async () => {
    const player = document.createElement('bach-player');
    const el = document.createElement('bach-conduct') as BachConductElement;
    el.setAttribute('channel', 'wss://example.test/c');
    // base64url-decode of "!" yields null (rejects on first non-charset byte).
    el.setAttribute('verify-key', '!!!');
    player.appendChild(el);
    const rejected = new Promise<CustomEvent>((resolve) => {
      el.addEventListener('bach:conduct-rejected', (e) => resolve(e as CustomEvent), {
        once: true,
      });
    });
    document.body.appendChild(player);
    const event = await rejected;
    expect(event.detail.reason).toBe('invalid-verify-key');
    expect(captured).toHaveLength(0);
  });

  it('rejects with reason "verify-key-import-failed" when SubtleCrypto throws', async () => {
    const player = document.createElement('bach-player');
    const el = document.createElement('bach-conduct') as BachConductElement;
    el.setAttribute('channel', 'wss://example.test/c');
    // 32 bytes of "A" → valid base64url-decode but importKey throws below.
    el.setAttribute('verify-key', 'A'.repeat(43));
    Object.defineProperty(globalThis.crypto, 'subtle', {
      configurable: true,
      value: { importKey: () => Promise.reject(new Error('not Ed25519')) },
    });
    const rejected = new Promise<CustomEvent>((resolve) => {
      el.addEventListener('bach:conduct-rejected', (e) => resolve(e as CustomEvent), {
        once: true,
      });
    });
    player.appendChild(el);
    document.body.appendChild(player);
    const event = await rejected;
    expect(event.detail.reason).toBe('verify-key-import-failed');
  });

  it('no-ops when there is no <bach-player> ancestor', async () => {
    const el = document.createElement('bach-conduct') as BachConductElement;
    el.setAttribute('channel', 'wss://example.test/c');
    el.setAttribute('verify-key', 'A'.repeat(43));
    Object.defineProperty(globalThis.crypto, 'subtle', {
      configurable: true,
      value: { importKey: () => Promise.resolve({} as CryptoKey) },
    });
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    expect(captured).toHaveLength(0);
    expect(el.viewer).toBeNull();
  });

  it('opens a WebSocket + viewer when everything resolves cleanly', async () => {
    const player = document.createElement('bach-player');
    const el = document.createElement('bach-conduct') as BachConductElement;
    el.setAttribute('channel', 'wss://example.test/c');
    el.setAttribute('verify-key', 'A'.repeat(43));
    Object.defineProperty(globalThis.crypto, 'subtle', {
      configurable: true,
      value: { importKey: () => Promise.resolve({} as CryptoKey) },
    });
    player.appendChild(el);
    document.body.appendChild(player);
    await new Promise((r) => setTimeout(r, 0));
    expect(captured).toHaveLength(1);
    expect(captured[0]?.url).toBe('wss://example.test/c');
    expect(el.viewer).not.toBeNull();
  });

  it('disconnect closes the viewer', async () => {
    const player = document.createElement('bach-player');
    const el = document.createElement('bach-conduct') as BachConductElement;
    el.setAttribute('channel', 'wss://example.test/c');
    el.setAttribute('verify-key', 'A'.repeat(43));
    Object.defineProperty(globalThis.crypto, 'subtle', {
      configurable: true,
      value: { importKey: () => Promise.resolve({} as CryptoKey) },
    });
    player.appendChild(el);
    document.body.appendChild(player);
    await new Promise((r) => setTimeout(r, 0));
    expect(el.viewer).not.toBeNull();
    el.remove();
    expect(el.viewer).toBeNull();
  });

  it('attribute change while connected restarts the viewer', async () => {
    const player = document.createElement('bach-player');
    const el = document.createElement('bach-conduct') as BachConductElement;
    el.setAttribute('channel', 'wss://example.test/c');
    el.setAttribute('verify-key', 'A'.repeat(43));
    Object.defineProperty(globalThis.crypto, 'subtle', {
      configurable: true,
      value: { importKey: () => Promise.resolve({} as CryptoKey) },
    });
    player.appendChild(el);
    document.body.appendChild(player);
    await new Promise((r) => setTimeout(r, 0));
    el.setAttribute('channel', 'wss://example.test/other');
    await new Promise((r) => setTimeout(r, 0));
    expect(captured.length).toBeGreaterThanOrEqual(2);
  });

  it('skips the start entirely when WebSocket is unavailable', async () => {
    Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: undefined });
    const player = document.createElement('bach-player');
    const el = document.createElement('bach-conduct') as BachConductElement;
    el.setAttribute('channel', 'wss://example.test/c');
    el.setAttribute('verify-key', 'A'.repeat(43));
    player.appendChild(el);
    document.body.appendChild(player);
    await new Promise((r) => setTimeout(r, 0));
    expect(el.viewer).toBeNull();
  });
});
