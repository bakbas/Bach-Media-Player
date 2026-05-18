import { effect } from '@preact/signals-core';
import { bindToBachHost } from './host-binding.js';

const TEMPLATE = `
<style>
  :host {
    display: block;
    width: 100%;
    height: 14px;
    cursor: pointer;
    outline: none;
    --_track: var(--bach-progress-track, color-mix(in oklch, currentcolor 25%, transparent));
    --_fill: var(--bach-progress-fill, var(--bach-color-accent, dodgerblue));
    --_buffer: var(--bach-progress-buffer, color-mix(in oklch, currentcolor 45%, transparent));
  }
  :host(:focus-visible) .track {
    box-shadow: 0 0 0 2px var(--bach-color-accent, dodgerblue);
  }
  .timeline {
    position: relative;
    height: 100%;
    display: flex;
    align-items: center;
  }
  .track {
    position: absolute;
    inset: 50% 0 auto 0;
    height: 4px;
    transform: translateY(-50%);
    background: var(--_track);
    border-radius: var(--bach-radius, 2px);
    overflow: hidden;
  }
  .buffer, .fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
  }
  .buffer { background: var(--_buffer); width: 0; }
  .fill { background: var(--_fill); width: 0; }
  .thumb {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--_fill);
    transform: translate(-50%, -50%);
    left: 0;
  }
</style>
<div class="timeline" part="timeline">
  <div class="track" part="progress-bar">
    <div class="buffer" part="progress-buffer"></div>
    <div class="fill" part="progress-fill"></div>
  </div>
  <div class="thumb" part="progress-thumb"></div>
</div>
`;

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * `<bach-progress>` — scrubbable seek bar. Reads `currentTime`, `duration`,
 * and `buffered` from the host state; writes `currentTime` on user input.
 * The slider is keyboard-accessible (Left/Right arrows step 5 s, Home/End
 * jump to ends) and dispatches `bach:seek` events the host can listen for.
 */
export class BachProgressElement extends HTMLElement {
  #shadow: ShadowRoot;
  #fill: HTMLElement | null = null;
  #buffer: HTMLElement | null = null;
  #thumb: HTMLElement | null = null;
  #teardown: (() => void) | null = null;
  #duration = 0;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open' });
    this.#shadow.innerHTML = TEMPLATE;
  }

  connectedCallback(): void {
    this.#fill = this.#shadow.querySelector('.fill');
    this.#buffer = this.#shadow.querySelector('.buffer');
    this.#thumb = this.#shadow.querySelector('.thumb');
    this.tabIndex = this.tabIndex || 0;
    if (!this.hasAttribute('role')) this.setAttribute('role', 'slider');
    this.setAttribute('aria-label', this.getAttribute('aria-label') ?? 'Seek');
    this.setAttribute('aria-valuemin', '0');
    this.setAttribute('aria-valuenow', '0');

    this.#teardown = bindToBachHost(this, (host) => {
      const seekToFraction = (fraction: number): void => {
        if (!host.video || !Number.isFinite(this.#duration) || this.#duration <= 0) return;
        host.video.currentTime = clamp01(fraction) * this.#duration;
      };

      const fractionFromEvent = (event: PointerEvent | MouseEvent): number => {
        const rect = this.getBoundingClientRect();
        if (rect.width <= 0) return 0;
        return clamp01((event.clientX - rect.left) / rect.width);
      };

      let dragging = false;

      const onPointerDown = (event: PointerEvent): void => {
        dragging = true;
        this.setPointerCapture(event.pointerId);
        seekToFraction(fractionFromEvent(event));
      };
      const onPointerMove = (event: PointerEvent): void => {
        if (!dragging) return;
        seekToFraction(fractionFromEvent(event));
      };
      const onPointerUp = (event: PointerEvent): void => {
        dragging = false;
        if (this.hasPointerCapture(event.pointerId)) this.releasePointerCapture(event.pointerId);
      };

      const onKey = (event: KeyboardEvent): void => {
        if (!host.video) return;
        const step = 5;
        switch (event.key) {
          case 'ArrowLeft':
            event.preventDefault();
            host.video.currentTime = Math.max(0, host.video.currentTime - step);
            break;
          case 'ArrowRight':
            event.preventDefault();
            host.video.currentTime = Math.min(
              this.#duration || host.video.duration || Number.MAX_SAFE_INTEGER,
              host.video.currentTime + step,
            );
            break;
          case 'Home':
            event.preventDefault();
            host.video.currentTime = 0;
            break;
          case 'End':
            event.preventDefault();
            if (Number.isFinite(this.#duration)) host.video.currentTime = this.#duration;
            break;
          default:
            break;
        }
      };

      this.addEventListener('pointerdown', onPointerDown);
      this.addEventListener('pointermove', onPointerMove);
      this.addEventListener('pointerup', onPointerUp);
      this.addEventListener('pointercancel', onPointerUp);
      this.addEventListener('keydown', onKey);

      const stopEffect = effect(() => {
        const duration = host.state.duration.value;
        this.#duration = Number.isFinite(duration) ? duration : 0;
        this.setAttribute('aria-valuemax', String(this.#duration || 0));

        const currentTime = host.state.currentTime.value;
        const fraction = this.#duration > 0 ? clamp01(currentTime / this.#duration) : 0;
        if (this.#fill) this.#fill.style.width = `${fraction * 100}%`;
        if (this.#thumb) this.#thumb.style.left = `${fraction * 100}%`;
        this.setAttribute('aria-valuenow', String(currentTime));

        const buffered = host.state.buffered.value;
        const lastEnd = buffered.at(-1)?.[1] ?? 0;
        const bufferFraction = this.#duration > 0 ? clamp01(lastEnd / this.#duration) : 0;
        if (this.#buffer) this.#buffer.style.width = `${bufferFraction * 100}%`;
      });

      return () => {
        this.removeEventListener('pointerdown', onPointerDown);
        this.removeEventListener('pointermove', onPointerMove);
        this.removeEventListener('pointerup', onPointerUp);
        this.removeEventListener('pointercancel', onPointerUp);
        this.removeEventListener('keydown', onKey);
        stopEffect();
      };
    });
  }

  disconnectedCallback(): void {
    this.#teardown?.();
    this.#teardown = null;
  }
}
