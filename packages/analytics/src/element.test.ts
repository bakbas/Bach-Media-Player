import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BachAnalyticsElement } from './element.js';

/**
 * `<bach-analytics>` smoke tests. happy-dom does not ship IndexedDB, so
 * the element falls through to the in-memory store; that's the path we
 * exercise here. The element's only public job is to expose a recorder
 * + store and attach a collector to the closest <bach-player>.
 */

beforeEach(() => {
  if (!customElements.get('bach-analytics')) {
    customElements.define('bach-analytics', BachAnalyticsElement);
  }
  if (!customElements.get('bach-player')) {
    customElements.define(
      'bach-player',
      class extends HTMLElement {
        video = document.createElement('video');
        state = {
          src: { value: '' },
          duration: { value: 0 },
          currentTime: { value: 0 },
          error: { value: null as { code: number; message: string } | null },
        };
      },
    );
  }
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('<bach-analytics>', () => {
  it('no-ops when there is no <bach-player> ancestor', () => {
    const el = document.createElement('bach-analytics') as BachAnalyticsElement;
    document.body.appendChild(el);
    expect(el.store).toBeNull();
    expect(el.recorder).toBeNull();
  });

  it('boots store + recorder + collector when mounted inside <bach-player>', () => {
    const player = document.createElement('bach-player');
    const el = document.createElement('bach-analytics') as BachAnalyticsElement;
    player.appendChild(el);
    document.body.appendChild(player);
    expect(el.store).not.toBeNull();
    expect(el.recorder).not.toBeNull();
  });

  it('uses the session attribute as the recorder session id', () => {
    const player = document.createElement('bach-player');
    const el = document.createElement('bach-analytics') as BachAnalyticsElement;
    el.setAttribute('session', 'fixed-id');
    player.appendChild(el);
    document.body.appendChild(player);
    expect(el.recorder?.session).toBe('fixed-id');
  });

  it('tears down store, recorder, and listeners on disconnect', () => {
    const player = document.createElement('bach-player');
    const el = document.createElement('bach-analytics') as BachAnalyticsElement;
    player.appendChild(el);
    document.body.appendChild(player);
    expect(el.store).not.toBeNull();
    el.remove();
    expect(el.store).toBeNull();
    expect(el.recorder).toBeNull();
  });
});
