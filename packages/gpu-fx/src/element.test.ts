import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Effect } from './effects.js';
import { BachGpuFxElement } from './element.js';
import { PRESETS } from './presets.js';

beforeAll(() => {
  if (!customElements.get('bach-gpu-fx')) {
    customElements.define('bach-gpu-fx', BachGpuFxElement);
  }
});

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(attrs: Record<string, string> = {}): BachGpuFxElement {
  const el = document.createElement('bach-gpu-fx') as BachGpuFxElement;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.appendChild(el);
  return el;
}

describe('<bach-gpu-fx>', () => {
  it('resolves a preset attribute to the registered chain', () => {
    const el = mount({ preset: 'cinematic' });
    expect(el.chain).toEqual(PRESETS.cinematic);
  });

  it('ignores an unknown preset value (returns empty chain)', () => {
    const el = mount({ preset: 'galactic' });
    expect(el.chain).toEqual([]);
  });

  it('merges preset + explicit chain (preset first, explicit appended)', () => {
    const el = mount({ preset: 'broadcast' });
    el.setChain([{ type: 'film-grain', amount: 0.1 }]);
    const chain = el.chain;
    expect(chain[0]?.type).toBe('color-grade');
    expect(chain[chain.length - 1]?.type).toBe('film-grain');
  });

  it('emits bach:gpu-fx-chain on connect and on every chain change', () => {
    document.body.innerHTML = '';
    const events: Array<{ chainLen: number }> = [];
    document.addEventListener('bach:gpu-fx-chain', (event) => {
      const detail = (event as CustomEvent).detail as { chain: unknown[] };
      events.push({ chainLen: detail.chain.length });
    });
    const el = document.createElement('bach-gpu-fx') as BachGpuFxElement;
    el.setAttribute('preset', 'cinematic');
    document.body.appendChild(el);
    el.setChain([{ type: 'film-grain', amount: 0.05 }]);
    el.setAttribute('preset', 'vintage');
    el.removeAttribute('preset');
    expect(events.length).toBeGreaterThanOrEqual(4);
    expect(events.at(-1)?.chainLen).toBe(1);
  });

  it('disabled attribute returns an empty effective chain', () => {
    const el = mount({ preset: 'cinematic', disabled: '' });
    expect(el.chain).toEqual([]);
  });

  it('drops null entries via mergeChains normalisation', () => {
    const el = mount();
    el.setChain([
      { type: 'color-grade', exposure: 1 },
      null as unknown as Effect,
      { type: 'film-grain' },
    ]);
    expect(el.chain).toHaveLength(2);
  });

  it('setChain triggers exactly one event', () => {
    const el = mount();
    const listener = vi.fn();
    el.addEventListener('bach:gpu-fx-chain', listener);
    el.setChain([{ type: 'color-grade' }]);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
