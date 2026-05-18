import { BachPlayerElement } from '@bach/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { BachPlayButtonElement } from './play-button.js';

beforeAll(() => {
  if (!customElements.get('bach-player')) {
    customElements.define('bach-player', BachPlayerElement);
  }
  if (!customElements.get('bach-play-button')) {
    customElements.define('bach-play-button', BachPlayButtonElement);
  }
});

function makePlayerWithVideo(): {
  player: BachPlayerElement;
  video: HTMLVideoElement;
} {
  document.body.innerHTML = '<bach-player><video slot="media"></video></bach-player>';
  const player = document.querySelector('bach-player') as BachPlayerElement;
  const video = player.querySelector('video') as HTMLVideoElement;
  // happy-dom does not implement play/pause; stub them.
  video.play = vi.fn(async () => {
    video.dispatchEvent(new Event('play'));
  }) as unknown as HTMLVideoElement['play'];
  video.pause = vi.fn(() => {
    Object.defineProperty(video, 'paused', { value: true, configurable: true });
    video.dispatchEvent(new Event('pause'));
  });
  return { player, video };
}

describe('<bach-play-button>', () => {
  it('exposes a button part with role=button', () => {
    document.body.innerHTML = '<bach-player><bach-play-button></bach-play-button></bach-player>';
    const btn = document.querySelector('bach-play-button');
    expect(btn?.getAttribute('role')).toBe('button');
    expect(btn?.shadowRoot?.querySelector('[part="play-button"]')).not.toBeNull();
  });

  it('reflects paused → aria-label="Play" and unsets data-playing', async () => {
    const { player } = makePlayerWithVideo();
    const btn = document.createElement('bach-play-button');
    player.appendChild(btn);
    player.state.paused.value = true;
    await Promise.resolve();
    expect(btn.getAttribute('aria-label')).toBe('Play');
    expect(btn.hasAttribute('data-playing')).toBe(false);
  });

  it('reflects playing → aria-label="Pause" and sets data-playing', async () => {
    const { player } = makePlayerWithVideo();
    const btn = document.createElement('bach-play-button');
    player.appendChild(btn);
    player.state.paused.value = false;
    await Promise.resolve();
    expect(btn.getAttribute('aria-label')).toBe('Pause');
    expect(btn.hasAttribute('data-playing')).toBe(true);
  });

  it('calls play() on click when paused', () => {
    const { player, video } = makePlayerWithVideo();
    Object.defineProperty(video, 'paused', { value: true, configurable: true });
    const btn = document.createElement('bach-play-button');
    player.appendChild(btn);
    btn.click();
    expect(video.play).toHaveBeenCalledTimes(1);
  });

  it('calls pause() on click when playing', () => {
    const { player, video } = makePlayerWithVideo();
    Object.defineProperty(video, 'paused', { value: false, configurable: true });
    const btn = document.createElement('bach-play-button');
    player.appendChild(btn);
    btn.click();
    expect(video.pause).toHaveBeenCalledTimes(1);
  });

  it('Space and Enter trigger activation', () => {
    const { player, video } = makePlayerWithVideo();
    Object.defineProperty(video, 'paused', { value: true, configurable: true });
    const btn = document.createElement('bach-play-button');
    player.appendChild(btn);
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(video.play).toHaveBeenCalledTimes(2);
  });
});
