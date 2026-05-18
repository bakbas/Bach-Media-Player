import { BachPlayerElement } from '@bach/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { BachProgressElement } from './progress.js';

beforeAll(() => {
  if (!customElements.get('bach-player')) {
    customElements.define('bach-player', BachPlayerElement);
  }
  if (!customElements.get('bach-progress')) {
    customElements.define('bach-progress', BachProgressElement);
  }
});

function makePlayer(): { player: BachPlayerElement; video: HTMLVideoElement } {
  document.body.innerHTML = '<bach-player><video slot="media"></video></bach-player>';
  const player = document.querySelector('bach-player') as BachPlayerElement;
  const video = player.querySelector('video') as HTMLVideoElement;
  Object.defineProperty(video, 'duration', { value: 100, configurable: true, writable: true });
  Object.defineProperty(video, 'currentTime', { value: 0, configurable: true, writable: true });
  return { player, video };
}

describe('<bach-progress>', () => {
  it('exposes slider semantics', () => {
    const { player } = makePlayer();
    const bar = document.createElement('bach-progress');
    player.appendChild(bar);
    expect(bar.getAttribute('role')).toBe('slider');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.shadowRoot?.querySelector('[part="timeline"]')).not.toBeNull();
    expect(bar.shadowRoot?.querySelector('[part="progress-bar"]')).not.toBeNull();
    expect(bar.shadowRoot?.querySelector('[part="progress-thumb"]')).not.toBeNull();
  });

  it('updates aria-valuemax and fill width from state', async () => {
    const { player } = makePlayer();
    const bar = document.createElement('bach-progress');
    player.appendChild(bar);
    player.state.duration.value = 100;
    player.state.currentTime.value = 50;
    await Promise.resolve();
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-valuenow')).toBe('50');
    const fill = bar.shadowRoot?.querySelector('.fill') as HTMLElement;
    expect(fill.style.width).toBe('50%');
  });

  it('renders buffered range width from the last buffered end', async () => {
    const { player } = makePlayer();
    const bar = document.createElement('bach-progress');
    player.appendChild(bar);
    player.state.duration.value = 200;
    player.state.buffered.value = [
      [0, 50],
      [80, 120],
    ];
    await Promise.resolve();
    const buffer = bar.shadowRoot?.querySelector('.buffer') as HTMLElement;
    expect(buffer.style.width).toBe('60%');
  });

  it('ArrowLeft / ArrowRight step by 5 s', () => {
    const { player, video } = makePlayer();
    const bar = document.createElement('bach-progress');
    player.appendChild(bar);
    player.state.duration.value = 100;
    video.currentTime = 30;
    bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(video.currentTime).toBe(35);
    bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(video.currentTime).toBe(30);
  });

  it('Home and End jump to the extremes', () => {
    const { player, video } = makePlayer();
    const bar = document.createElement('bach-progress');
    player.appendChild(bar);
    player.state.duration.value = 100;
    video.currentTime = 30;
    bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(video.currentTime).toBe(100);
    bar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(video.currentTime).toBe(0);
  });
});
