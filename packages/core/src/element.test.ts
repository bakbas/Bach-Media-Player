import { beforeAll, describe, expect, it } from 'vitest';
import { BachPlayerElement } from './element.js';

beforeAll(() => {
  if (!customElements.get('bach-player')) {
    customElements.define('bach-player', BachPlayerElement);
  }
});

function makePlayer(attrs: Record<string, string | null> = {}): BachPlayerElement {
  const el = document.createElement('bach-player') as BachPlayerElement;
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null) el.setAttribute(k, v);
  }
  document.body.appendChild(el);
  return el;
}

describe('<bach-player>', () => {
  it('attaches an open shadow root with the expected slots', () => {
    const el = makePlayer();
    const root = el.shadowRoot;
    expect(root).not.toBeNull();
    expect(root?.querySelector('slot[name="media"]')).not.toBeNull();
    expect(root?.querySelector('slot[name="controls"]')).not.toBeNull();
    expect(root?.querySelector('slot[name="overlay"]')).not.toBeNull();
    el.remove();
  });

  it('seeds state from initial attributes', () => {
    const el = makePlayer({ src: 'video.m3u8', muted: '', headless: '' });
    const snap = el.state.snapshot();
    expect(snap.src).toBe('video.m3u8');
    expect(snap.muted).toBe(true);
    expect(snap.headless).toBe(true);
    el.remove();
  });

  it('mirrors attribute changes into the state', () => {
    const el = makePlayer({ src: 'a.m3u8' });
    expect(el.state.src.value).toBe('a.m3u8');
    el.setAttribute('src', 'b.m3u8');
    expect(el.state.src.value).toBe('b.m3u8');
    el.setAttribute('muted', '');
    expect(el.state.muted.value).toBe(true);
    el.removeAttribute('muted');
    expect(el.state.muted.value).toBe(false);
    el.remove();
  });

  it('clears the cached video reference on disconnect', () => {
    const el = makePlayer({ src: 'a.m3u8' });
    const v = document.createElement('video');
    v.setAttribute('slot', 'media');
    el.appendChild(v);
    el.remove();
    expect(el.video).toBeNull();
  });
});
