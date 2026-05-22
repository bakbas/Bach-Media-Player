import { BachPlayerElement } from '@bach/core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BachFullscreenButtonElement } from './fullscreen-button.js';

beforeAll(() => {
  if (!customElements.get('bach-player')) {
    customElements.define('bach-player', BachPlayerElement);
  }
  if (!customElements.get('bach-fullscreen-button')) {
    customElements.define('bach-fullscreen-button', BachFullscreenButtonElement);
  }
});

function mount(): {
  player: BachPlayerElement;
  button: BachFullscreenButtonElement;
} {
  document.body.innerHTML =
    '<bach-player><bach-fullscreen-button></bach-fullscreen-button></bach-player>';
  const player = document.querySelector('bach-player') as BachPlayerElement;
  const button = player.querySelector('bach-fullscreen-button') as BachFullscreenButtonElement;
  return { player, button };
}

beforeEach(() => {
  Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
  Object.defineProperty(document, 'webkitFullscreenElement', { value: null, configurable: true });
});

describe('<bach-fullscreen-button>', () => {
  it('renders an open shadow root with a button under part="fullscreen-button"', () => {
    const { button } = mount();
    const inner = button.shadowRoot?.querySelector('button[part="fullscreen-button"]');
    expect(inner).not.toBeNull();
  });

  it('exposes tabindex and role for keyboard / a11y discovery', () => {
    const { button } = mount();
    expect(button.getAttribute('role')).toBe('button');
    expect(button.tabIndex).toBeGreaterThanOrEqual(0);
  });

  it('starts with aria-label "Enter fullscreen" when nothing is fullscreen', () => {
    const { button } = mount();
    expect(button.getAttribute('aria-label')).toBe('Enter fullscreen');
  });

  it('flips data-fullscreen + aria-label when fullscreenchange fires after entering', () => {
    const { player, button } = mount();
    Object.defineProperty(document, 'fullscreenElement', { value: player, configurable: true });
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(button.hasAttribute('data-fullscreen')).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('Exit fullscreen');
  });

  it('click while not fullscreen calls host.requestFullscreen', () => {
    const { player, button } = mount();
    const request = vi.fn(async () => {});
    (player as unknown as { requestFullscreen: () => Promise<void> }).requestFullscreen = request;
    button.click();
    expect(request).toHaveBeenCalled();
  });

  it('click while fullscreen calls document.exitFullscreen', () => {
    const { player, button } = mount();
    Object.defineProperty(document, 'fullscreenElement', { value: player, configurable: true });
    const exit = vi.fn(async () => {});
    (document as unknown as { exitFullscreen: () => Promise<void> }).exitFullscreen = exit;
    button.click();
    expect(exit).toHaveBeenCalled();
  });

  it('Space and Enter activate the button', () => {
    const { player, button } = mount();
    const request = vi.fn(async () => {});
    (player as unknown as { requestFullscreen: () => Promise<void> }).requestFullscreen = request;
    button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(request).toHaveBeenCalledTimes(1);
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('ignores other keys', () => {
    const { player, button } = mount();
    const request = vi.fn(async () => {});
    (player as unknown as { requestFullscreen: () => Promise<void> }).requestFullscreen = request;
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(request).not.toHaveBeenCalled();
  });

  it('falls back to webkitRequestFullscreen when the standard request returns void', () => {
    const { player, button } = mount();
    const webkit = vi.fn();
    Object.assign(player, { requestFullscreen: undefined, webkitRequestFullscreen: webkit });
    button.click();
    expect(webkit).toHaveBeenCalled();
  });

  it('falls back to webkitRequestFullscreen when the standard request rejects', async () => {
    const { player, button } = mount();
    const webkit = vi.fn();
    Object.assign(player, {
      requestFullscreen: () => Promise.reject(new Error('denied')),
      webkitRequestFullscreen: webkit,
    });
    button.click();
    await Promise.resolve();
    expect(webkit).toHaveBeenCalled();
  });

  it('exit falls back to webkitExitFullscreen', () => {
    const { player, button } = mount();
    Object.defineProperty(document, 'fullscreenElement', { value: player, configurable: true });
    const webkitExit = vi.fn();
    Object.assign(document, { exitFullscreen: undefined, webkitExitFullscreen: webkitExit });
    button.click();
    expect(webkitExit).toHaveBeenCalled();
  });

  it('webkitFullscreenElement is honoured by isFullscreen', () => {
    const { player, button } = mount();
    Object.defineProperty(document, 'webkitFullscreenElement', {
      value: player,
      configurable: true,
    });
    document.dispatchEvent(new Event('webkitfullscreenchange'));
    expect(button.hasAttribute('data-fullscreen')).toBe(true);
  });

  it('disconnect detaches every listener', () => {
    const { player, button } = mount();
    const request = vi.fn(async () => {});
    (player as unknown as { requestFullscreen: () => Promise<void> }).requestFullscreen = request;
    button.remove();
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    button.click();
    expect(request).not.toHaveBeenCalled();
  });
});
