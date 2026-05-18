import { BachPlayerElement } from '@bach/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { BachVolumeElement } from './volume.js';

beforeAll(() => {
  if (!customElements.get('bach-player')) {
    customElements.define('bach-player', BachPlayerElement);
  }
  if (!customElements.get('bach-volume')) {
    customElements.define('bach-volume', BachVolumeElement);
  }
});

function makePlayer(): { player: BachPlayerElement; video: HTMLVideoElement } {
  document.body.innerHTML = '<bach-player><video slot="media"></video></bach-player>';
  const player = document.querySelector('bach-player') as BachPlayerElement;
  const video = player.querySelector('video') as HTMLVideoElement;
  Object.defineProperty(video, 'volume', { value: 1, configurable: true, writable: true });
  Object.defineProperty(video, 'muted', { value: false, configurable: true, writable: true });
  return { player, video };
}

describe('<bach-volume>', () => {
  it('exposes button + slider parts', () => {
    const { player } = makePlayer();
    const vol = document.createElement('bach-volume');
    player.appendChild(vol);
    expect(vol.shadowRoot?.querySelector('[part="volume-button"]')).not.toBeNull();
    expect(vol.shadowRoot?.querySelector('[part="volume-slider"]')).not.toBeNull();
  });

  it('reflects muted state and updates aria-label to Unmute', async () => {
    const { player } = makePlayer();
    const vol = document.createElement('bach-volume');
    player.appendChild(vol);
    player.state.muted.value = true;
    await Promise.resolve();
    const btn = vol.shadowRoot?.querySelector('button');
    expect(btn?.getAttribute('aria-label')).toBe('Unmute');
    expect(vol.getAttribute('data-state')).toBe('muted');
  });

  it('classifies effective volume as quiet/loud', async () => {
    const { player } = makePlayer();
    const vol = document.createElement('bach-volume');
    player.appendChild(vol);
    player.state.volume.value = 0.25;
    player.state.muted.value = false;
    await Promise.resolve();
    expect(vol.getAttribute('data-state')).toBe('quiet');
    player.state.volume.value = 0.9;
    await Promise.resolve();
    expect(vol.getAttribute('data-state')).toBe('loud');
  });

  it('mute button toggles video.muted', () => {
    const { player, video } = makePlayer();
    const vol = document.createElement('bach-volume');
    player.appendChild(vol);
    const btn = vol.shadowRoot?.querySelector('button') as HTMLButtonElement;
    btn.click();
    expect(video.muted).toBe(true);
    btn.click();
    expect(video.muted).toBe(false);
  });

  it('slider keyboard steps adjust video.volume', () => {
    const { player, video } = makePlayer();
    const vol = document.createElement('bach-volume');
    player.appendChild(vol);
    const slider = vol.shadowRoot?.querySelector('.slider') as HTMLElement;
    video.volume = 0.5;
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(video.volume).toBeCloseTo(0.55, 5);
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(video.volume).toBe(0);
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(video.volume).toBe(1);
  });
});
