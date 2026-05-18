import { BachPlayerElement } from '@bach/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { BachTimeElement, formatTime } from './time.js';

beforeAll(() => {
  if (!customElements.get('bach-player')) {
    customElements.define('bach-player', BachPlayerElement);
  }
  if (!customElements.get('bach-time')) {
    customElements.define('bach-time', BachTimeElement);
  }
});

describe('formatTime', () => {
  it('renders seconds with leading zero', () => {
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(65)).toBe('1:05');
  });
  it('renders hours when >= 3600', () => {
    expect(formatTime(3725)).toBe('1:02:05');
  });
  it('clamps NaN / negative / Infinity to 0:00', () => {
    expect(formatTime(Number.NaN)).toBe('0:00');
    expect(formatTime(-5)).toBe('0:00');
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe('0:00');
  });
});

describe('<bach-time>', () => {
  it('renders current and total time from host state', async () => {
    document.body.innerHTML = '<bach-player></bach-player>';
    const player = document.querySelector('bach-player') as BachPlayerElement;
    player.state.currentTime.value = 65;
    player.state.duration.value = 130;
    const time = document.createElement('bach-time');
    player.appendChild(time);
    // give effect() a tick
    await Promise.resolve();
    const current = time.shadowRoot?.querySelector('.current');
    const total = time.shadowRoot?.querySelector('.total');
    expect(current?.textContent).toBe('1:05');
    expect(total?.textContent).toBe('2:10');
  });

  it('updates when state changes', async () => {
    document.body.innerHTML = '<bach-player></bach-player>';
    const player = document.querySelector('bach-player') as BachPlayerElement;
    const time = document.createElement('bach-time');
    player.appendChild(time);
    await Promise.resolve();
    player.state.currentTime.value = 12;
    player.state.duration.value = 60;
    await Promise.resolve();
    const current = time.shadowRoot?.querySelector('.current');
    expect(current?.textContent).toBe('0:12');
  });
});
