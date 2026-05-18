import { effect } from '@preact/signals-core';
import { bindToBachHost } from './host-binding.js';

const TEMPLATE = `
<style>
  :host {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    color: var(--bach-color-fg, currentColor);
    font: inherit;
    font-variant-numeric: tabular-nums;
    user-select: none;
  }
  .sep { opacity: 0.5; }
</style>
<span class="current" part="time-display">0:00</span><span class="sep">/</span><span class="total">0:00</span>
`;

/**
 * Format a time value in seconds as `h:mm:ss` when needed, otherwise
 * `m:ss`. NaN and non-finite values render as `0:00`.
 */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = s.toString().padStart(2, '0');
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

/**
 * `<bach-time>` — current / total time display. `current` part for the
 * elapsed value, `time-display` for the wrapper. Pure read of host state.
 */
export class BachTimeElement extends HTMLElement {
  #shadow: ShadowRoot;
  #current: HTMLElement | null = null;
  #total: HTMLElement | null = null;
  #teardown: (() => void) | null = null;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open' });
    this.#shadow.innerHTML = TEMPLATE;
  }

  connectedCallback(): void {
    this.#current = this.#shadow.querySelector('.current');
    this.#total = this.#shadow.querySelector('.total');

    this.#teardown = bindToBachHost(this, (host) => {
      const stop = effect(() => {
        const currentText = formatTime(host.state.currentTime.value);
        const durationText = formatTime(host.state.duration.value);
        if (this.#current) this.#current.textContent = currentText;
        if (this.#total) this.#total.textContent = durationText;
        this.setAttribute('aria-label', `${currentText} of ${durationText}`);
      });
      return () => stop();
    });
  }

  disconnectedCallback(): void {
    this.#teardown?.();
    this.#teardown = null;
  }
}
