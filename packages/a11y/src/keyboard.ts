import type { BachPlayerElement } from '@bach/core';

/**
 * Canonical media-player keyboard map. Mirrors YouTube / Vimeo so users do
 * not relearn anything. The handler is exported as a pure function over a
 * minimal video-like interface for unit testing; the installer below wires
 * it to a host player's keydown stream.
 */
export type KeyboardAction =
  | { type: 'playpause' }
  | { type: 'mute' }
  | { type: 'fullscreen' }
  | { type: 'seek-rel'; delta: number }
  | { type: 'seek-fraction'; fraction: number }
  | { type: 'volume-rel'; delta: number };

interface KeyEventLike {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

/**
 * Pure mapping from a keyboard event to a player action. Returns `null` when
 * the key is unbound, so callers can avoid `preventDefault()` on
 * non-shortcuts and let the browser keep its native behaviour.
 *
 * - Space, k: toggle play/pause
 * - m: toggle mute
 * - f: toggle fullscreen
 * - j: rewind 10 s, l: forward 10 s
 * - ArrowLeft: -5 s, ArrowRight: +5 s
 * - ArrowUp: volume +5 %, ArrowDown: volume -5 %
 * - 0-9: jump to that 10 % of the duration
 */
export function keyToAction(event: KeyEventLike): KeyboardAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  switch (event.key) {
    case ' ':
    case 'k':
    case 'K':
      return { type: 'playpause' };
    case 'm':
    case 'M':
      return { type: 'mute' };
    case 'f':
    case 'F':
      return { type: 'fullscreen' };
    case 'j':
    case 'J':
      return { type: 'seek-rel', delta: -10 };
    case 'l':
    case 'L':
      return { type: 'seek-rel', delta: 10 };
    case 'ArrowLeft':
      return { type: 'seek-rel', delta: -5 };
    case 'ArrowRight':
      return { type: 'seek-rel', delta: 5 };
    case 'ArrowUp':
      return { type: 'volume-rel', delta: 0.05 };
    case 'ArrowDown':
      return { type: 'volume-rel', delta: -0.05 };
    default: {
      const digit = Number.parseInt(event.key, 10);
      if (!Number.isNaN(digit) && digit >= 0 && digit <= 9) {
        return { type: 'seek-fraction', fraction: digit / 10 };
      }
      return null;
    }
  }
}

type FullscreenCapable = HTMLElement & {
  webkitRequestFullscreen?: () => void;
};

/**
 * Apply an action to a `<bach-player>`. Falls through silently when the
 * required surface (e.g. `host.video`) is not available — caller decides
 * whether to surface a warning.
 */
export function applyAction(host: BachPlayerElement, action: KeyboardAction): void {
  const video = host.video;
  switch (action.type) {
    case 'playpause':
      if (!video) return;
      if (video.paused) video.play().catch(() => {});
      else video.pause();
      return;
    case 'mute':
      if (!video) return;
      video.muted = !video.muted;
      return;
    case 'seek-rel': {
      if (!video) return;
      const next = (video.currentTime ?? 0) + action.delta;
      const max = Number.isFinite(video.duration) ? video.duration : next;
      video.currentTime = Math.max(0, Math.min(max, next));
      return;
    }
    case 'seek-fraction': {
      if (!video) return;
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      video.currentTime = video.duration * action.fraction;
      return;
    }
    case 'volume-rel': {
      if (!video) return;
      const next = (video.volume ?? 0) + action.delta;
      video.volume = Math.max(0, Math.min(1, next));
      if (next > 0 && video.muted) video.muted = false;
      return;
    }
    case 'fullscreen': {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      } else {
        const target = host as unknown as FullscreenCapable;
        const promise = target.requestFullscreen?.();
        if (promise && typeof promise.catch === 'function') {
          promise.catch(() => target.webkitRequestFullscreen?.());
        } else {
          target.webkitRequestFullscreen?.();
        }
      }
      return;
    }
  }
}

export interface InstallShortcutsOptions {
  /** Skip handling when the keystroke originates inside an editable target. */
  ignoreEditable?: boolean;
}

function isEditableEventTarget(event: KeyboardEvent): boolean {
  const target = event.target as Element | null;
  if (!target) return false;
  const el = target as HTMLElement;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * Install keyboard shortcuts on a host player. The listener attaches to the
 * player element itself, so shortcuts only fire when the player (or one of
 * its descendants) is focused — preventing the page-wide hijack people hate.
 *
 * Returns an uninstall function for symmetry with the rest of the SDK.
 */
export function installKeyboardShortcuts(
  host: BachPlayerElement,
  opts: InstallShortcutsOptions = {},
): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (opts.ignoreEditable !== false && isEditableEventTarget(event)) return;
    const action = keyToAction(event);
    if (!action) return;
    event.preventDefault();
    applyAction(host, action);
  };

  if (!host.hasAttribute('tabindex')) host.setAttribute('tabindex', '0');
  host.addEventListener('keydown', onKeyDown);
  return () => {
    host.removeEventListener('keydown', onKeyDown);
  };
}
