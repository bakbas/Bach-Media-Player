import { BachPlayerElement } from '@bach/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { applyAction, installKeyboardShortcuts, keyToAction } from './keyboard.js';

beforeAll(() => {
  if (!customElements.get('bach-player')) {
    customElements.define('bach-player', BachPlayerElement);
  }
});

describe('keyToAction', () => {
  it('maps space and k to playpause', () => {
    expect(keyToAction({ key: ' ' })).toEqual({ type: 'playpause' });
    expect(keyToAction({ key: 'k' })).toEqual({ type: 'playpause' });
    expect(keyToAction({ key: 'K' })).toEqual({ type: 'playpause' });
  });
  it('maps j and l to relative seeks', () => {
    expect(keyToAction({ key: 'j' })).toEqual({ type: 'seek-rel', delta: -10 });
    expect(keyToAction({ key: 'l' })).toEqual({ type: 'seek-rel', delta: 10 });
  });
  it('maps arrow keys to short seek and volume steps', () => {
    expect(keyToAction({ key: 'ArrowLeft' })).toEqual({ type: 'seek-rel', delta: -5 });
    expect(keyToAction({ key: 'ArrowRight' })).toEqual({ type: 'seek-rel', delta: 5 });
    expect(keyToAction({ key: 'ArrowUp' })).toEqual({ type: 'volume-rel', delta: 0.05 });
    expect(keyToAction({ key: 'ArrowDown' })).toEqual({ type: 'volume-rel', delta: -0.05 });
  });
  it('maps digits 0-9 to a seek fraction', () => {
    expect(keyToAction({ key: '0' })).toEqual({ type: 'seek-fraction', fraction: 0 });
    expect(keyToAction({ key: '5' })).toEqual({ type: 'seek-fraction', fraction: 0.5 });
    expect(keyToAction({ key: '9' })).toEqual({ type: 'seek-fraction', fraction: 0.9 });
  });
  it('returns null when a modifier is held (avoid hijacking browser shortcuts)', () => {
    expect(keyToAction({ key: 'k', ctrlKey: true })).toBeNull();
    expect(keyToAction({ key: 'f', metaKey: true })).toBeNull();
  });
  it('returns null for unknown keys', () => {
    expect(keyToAction({ key: 'q' })).toBeNull();
  });

  it('uppercase shortcut letters fall through the same branches', () => {
    expect(keyToAction({ key: 'K' })).toEqual({ type: 'playpause' });
    expect(keyToAction({ key: 'M' })).toEqual({ type: 'mute' });
    expect(keyToAction({ key: 'F' })).toEqual({ type: 'fullscreen' });
    expect(keyToAction({ key: 'J' })).toEqual({ type: 'seek-rel', delta: -10 });
    expect(keyToAction({ key: 'L' })).toEqual({ type: 'seek-rel', delta: 10 });
  });
});

function makePlayerWithVideo(): { player: BachPlayerElement; video: HTMLVideoElement } {
  document.body.innerHTML = '<bach-player><video slot="media"></video></bach-player>';
  const player = document.querySelector('bach-player') as BachPlayerElement;
  const video = player.querySelector('video') as HTMLVideoElement;
  Object.defineProperty(video, 'duration', { value: 100, configurable: true, writable: true });
  Object.defineProperty(video, 'currentTime', { value: 50, configurable: true, writable: true });
  Object.defineProperty(video, 'volume', { value: 0.5, configurable: true, writable: true });
  Object.defineProperty(video, 'muted', { value: false, configurable: true, writable: true });
  Object.defineProperty(video, 'paused', { value: true, configurable: true, writable: true });
  video.play = vi.fn(async () => {}) as unknown as HTMLVideoElement['play'];
  video.pause = vi.fn();
  return { player, video };
}

describe('applyAction', () => {
  it('seek-rel clamps to [0, duration]', () => {
    const { player, video } = makePlayerWithVideo();
    video.currentTime = 95;
    applyAction(player, { type: 'seek-rel', delta: 10 });
    expect(video.currentTime).toBe(100);
    video.currentTime = 3;
    applyAction(player, { type: 'seek-rel', delta: -10 });
    expect(video.currentTime).toBe(0);
  });
  it('seek-fraction jumps to a percentage of duration', () => {
    const { player, video } = makePlayerWithVideo();
    applyAction(player, { type: 'seek-fraction', fraction: 0.5 });
    expect(video.currentTime).toBe(50);
    applyAction(player, { type: 'seek-fraction', fraction: 0.1 });
    expect(video.currentTime).toBe(10);
  });
  it('volume-rel clamps to [0, 1] and unmutes when raising from 0', () => {
    const { player, video } = makePlayerWithVideo();
    video.volume = 0.95;
    applyAction(player, { type: 'volume-rel', delta: 0.1 });
    expect(video.volume).toBe(1);
    video.volume = 0;
    video.muted = true;
    applyAction(player, { type: 'volume-rel', delta: 0.1 });
    expect(video.volume).toBeCloseTo(0.1, 5);
    expect(video.muted).toBe(false);
  });
  it('mute toggles video.muted', () => {
    const { player, video } = makePlayerWithVideo();
    applyAction(player, { type: 'mute' });
    expect(video.muted).toBe(true);
    applyAction(player, { type: 'mute' });
    expect(video.muted).toBe(false);
  });
  it('playpause calls play when paused, pause when playing', () => {
    const { player, video } = makePlayerWithVideo();
    Object.defineProperty(video, 'paused', { value: true, configurable: true });
    applyAction(player, { type: 'playpause' });
    expect(video.play).toHaveBeenCalled();
    Object.defineProperty(video, 'paused', { value: false, configurable: true });
    applyAction(player, { type: 'playpause' });
    expect(video.pause).toHaveBeenCalled();
  });

  it('fullscreen: requests via standard API when no fullscreen element is set', () => {
    const { player } = makePlayerWithVideo();
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
    const request = vi.fn(async () => {});
    (player as unknown as { requestFullscreen: () => Promise<void> }).requestFullscreen = request;
    applyAction(player, { type: 'fullscreen' });
    expect(request).toHaveBeenCalled();
  });

  it('fullscreen: exits via document.exitFullscreen when one is already set', () => {
    const { player } = makePlayerWithVideo();
    Object.defineProperty(document, 'fullscreenElement', { value: player, configurable: true });
    const exit = vi.fn(async () => {});
    (document as unknown as { exitFullscreen: () => Promise<void> }).exitFullscreen = exit;
    applyAction(player, { type: 'fullscreen' });
    expect(exit).toHaveBeenCalled();
  });

  it('fullscreen: falls back to webkitRequestFullscreen when the promise rejects', async () => {
    const { player } = makePlayerWithVideo();
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
    const webkit = vi.fn();
    const failing = vi.fn(() => Promise.reject(new Error('blocked')));
    Object.assign(player, { requestFullscreen: failing, webkitRequestFullscreen: webkit });
    applyAction(player, { type: 'fullscreen' });
    // Wait one microtask tick so the promise.catch fallback runs.
    await Promise.resolve();
    expect(webkit).toHaveBeenCalled();
  });

  it('fullscreen: uses webkitRequestFullscreen directly when no promise is returned', () => {
    const { player } = makePlayerWithVideo();
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
    const webkit = vi.fn();
    Object.assign(player, { requestFullscreen: undefined, webkitRequestFullscreen: webkit });
    applyAction(player, { type: 'fullscreen' });
    expect(webkit).toHaveBeenCalled();
  });
});

describe('installKeyboardShortcuts', () => {
  it('attaches a tabindex and reacts to bound keys', () => {
    const { player, video } = makePlayerWithVideo();
    const uninstall = installKeyboardShortcuts(player);
    expect(player.getAttribute('tabindex')).toBe('0');
    player.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(video.play).toHaveBeenCalled();
    uninstall();
    player.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(video.play).toHaveBeenCalledTimes(1);
  });

  it('does not intercept keystrokes in editable targets', () => {
    const { player, video } = makePlayerWithVideo();
    installKeyboardShortcuts(player);
    const input = document.createElement('input');
    player.appendChild(input);
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(video.play).not.toHaveBeenCalled();
  });
});
