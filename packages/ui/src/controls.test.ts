import { beforeAll, describe, expect, it } from 'vitest';
import { BachControlsElement } from './controls.js';

beforeAll(() => {
  if (!customElements.get('bach-controls')) {
    customElements.define('bach-controls', BachControlsElement);
  }
});

describe('<bach-controls>', () => {
  it('attaches an open shadow root with a slot', () => {
    const el = document.createElement('bach-controls');
    document.body.appendChild(el);
    expect(el.shadowRoot).not.toBeNull();
    expect(el.shadowRoot?.querySelector('slot')).not.toBeNull();
  });

  it('exposes part=chrome by default but respects an override', () => {
    const a = document.createElement('bach-controls');
    document.body.appendChild(a);
    expect(a.getAttribute('part')).toBe('chrome');
    const b = document.createElement('bach-controls');
    b.setAttribute('part', 'custom-chrome');
    document.body.appendChild(b);
    expect(b.getAttribute('part')).toBe('custom-chrome');
  });
});
