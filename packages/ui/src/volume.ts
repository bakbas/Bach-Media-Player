import { effect } from '@preact/signals-core';
import { bindToBachHost } from './host-binding.js';

const TEMPLATE = `
<style>
  :host {
    display: inline-flex;
    align-items: center;
    gap: var(--bach-control-gap, 4px);
    color: var(--bach-color-fg, currentColor);
    --_fill: var(--bach-color-accent, dodgerblue);
    --_track: var(--bach-progress-track, color-mix(in oklch, currentcolor 25%, transparent));
  }
  button {
    all: unset;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--bach-control-size, 36px);
    height: var(--bach-control-size, 36px);
    border-radius: var(--bach-radius, 4px);
    cursor: pointer;
  }
  button:focus-visible { box-shadow: 0 0 0 2px var(--bach-color-accent, dodgerblue); }
  svg { width: 60%; height: 60%; fill: currentColor; }
  .muted-icon, .loud-icon { display: none; }
  :host([data-state="muted"]) .muted-icon { display: block; }
  :host([data-state="muted"]) .loud-icon { display: none; }
  :host([data-state="muted"]) .loud-icon, :host([data-state="muted"]) .quiet-icon { display: none; }
  :host([data-state="loud"]) .loud-icon { display: block; }
  :host([data-state="loud"]) .quiet-icon, :host([data-state="loud"]) .muted-icon { display: none; }
  :host([data-state="quiet"]) .quiet-icon { display: block; }
  :host([data-state="quiet"]) .loud-icon, :host([data-state="quiet"]) .muted-icon { display: none; }
  .slider {
    position: relative;
    width: 80px;
    height: 4px;
    background: var(--_track);
    border-radius: var(--bach-radius, 2px);
    cursor: pointer;
    outline: none;
  }
  .slider:focus-visible { box-shadow: 0 0 0 2px var(--bach-color-accent, dodgerblue); }
  .slider-fill {
    position: absolute;
    inset: 0 auto 0 0;
    width: 100%;
    background: var(--_fill);
    border-radius: inherit;
  }
</style>
<button part="volume-button" type="button" aria-label="Mute">
  <svg class="loud-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/></svg>
  <svg class="quiet-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3z"/></svg>
  <svg class="muted-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm14 2-2 2 2 2-1.5 1.5L13.5 14.5l-2 2L10 15l2-2-2-2 1.5-1.5L13.5 11.5l2-2L17 11z"/></svg>
</button>
<div class="slider" part="volume-slider" tabindex="0" role="slider" aria-label="Volume" aria-valuemin="0" aria-valuemax="1" aria-valuenow="1">
  <div class="slider-fill" part="volume-slider-fill"></div>
</div>
`;

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * `<bach-volume>` — mute toggle + volume slider. Reads `volume` and `muted`
 * from the host state, writes both on user input. Keeps three icon states
 * (loud / quiet / muted) toggled via `data-state` so consumer CSS can
 * override the bundled icons.
 */
export class BachVolumeElement extends HTMLElement {
  #shadow: ShadowRoot;
  #button: HTMLButtonElement | null = null;
  #slider: HTMLElement | null = null;
  #fill: HTMLElement | null = null;
  #teardown: (() => void) | null = null;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open' });
    this.#shadow.innerHTML = TEMPLATE;
  }

  connectedCallback(): void {
    this.#button = this.#shadow.querySelector('button');
    this.#slider = this.#shadow.querySelector('.slider');
    this.#fill = this.#shadow.querySelector('.slider-fill');

    this.#teardown = bindToBachHost(this, (host) => {
      const setVolume = (value: number): void => {
        if (!host.video) return;
        const clamped = clamp01(value);
        host.video.volume = clamped;
        if (clamped === 0) host.video.muted = true;
        else if (host.video.muted) host.video.muted = false;
      };

      const toggleMute = (): void => {
        if (!host.video) return;
        host.video.muted = !host.video.muted;
      };

      const sliderFraction = (event: PointerEvent): number => {
        if (!this.#slider) return 0;
        const rect = this.#slider.getBoundingClientRect();
        if (rect.width <= 0) return 0;
        return clamp01((event.clientX - rect.left) / rect.width);
      };

      let dragging = false;
      const onPointerDown = (event: PointerEvent): void => {
        dragging = true;
        this.#slider?.setPointerCapture(event.pointerId);
        setVolume(sliderFraction(event));
      };
      const onPointerMove = (event: PointerEvent): void => {
        if (!dragging) return;
        setVolume(sliderFraction(event));
      };
      const onPointerUp = (event: PointerEvent): void => {
        dragging = false;
        if (this.#slider?.hasPointerCapture(event.pointerId)) {
          this.#slider.releasePointerCapture(event.pointerId);
        }
      };

      const onSliderKey = (event: KeyboardEvent): void => {
        if (!host.video) return;
        const step = 0.05;
        switch (event.key) {
          case 'ArrowUp':
          case 'ArrowRight':
            event.preventDefault();
            setVolume((host.video.volume ?? 0) + step);
            break;
          case 'ArrowDown':
          case 'ArrowLeft':
            event.preventDefault();
            setVolume((host.video.volume ?? 0) - step);
            break;
          case 'Home':
            event.preventDefault();
            setVolume(0);
            break;
          case 'End':
            event.preventDefault();
            setVolume(1);
            break;
          default:
            break;
        }
      };

      this.#button?.addEventListener('click', toggleMute);
      this.#slider?.addEventListener('pointerdown', onPointerDown);
      this.#slider?.addEventListener('pointermove', onPointerMove);
      this.#slider?.addEventListener('pointerup', onPointerUp);
      this.#slider?.addEventListener('keydown', onSliderKey);

      const stopEffect = effect(() => {
        const volume = host.state.volume.value;
        const muted = host.state.muted.value;
        const effective = muted ? 0 : volume;
        const state = muted || effective === 0 ? 'muted' : effective < 0.5 ? 'quiet' : 'loud';
        this.setAttribute('data-state', state);
        if (this.#fill) this.#fill.style.width = `${effective * 100}%`;
        this.#slider?.setAttribute('aria-valuenow', effective.toFixed(2));
        const buttonLabel = muted ? 'Unmute' : 'Mute';
        this.#button?.setAttribute('aria-label', buttonLabel);
      });

      return () => {
        this.#button?.removeEventListener('click', toggleMute);
        this.#slider?.removeEventListener('pointerdown', onPointerDown);
        this.#slider?.removeEventListener('pointermove', onPointerMove);
        this.#slider?.removeEventListener('pointerup', onPointerUp);
        this.#slider?.removeEventListener('keydown', onSliderKey);
        stopEffect();
      };
    });
  }

  disconnectedCallback(): void {
    this.#teardown?.();
    this.#teardown = null;
  }
}
