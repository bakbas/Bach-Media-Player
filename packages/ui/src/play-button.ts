import { effect } from '@preact/signals-core';
import { bindToBachHost } from './host-binding.js';

const TEMPLATE = `
<style>
  :host {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--bach-control-size, 36px);
    height: var(--bach-control-size, 36px);
    border-radius: var(--bach-radius, 4px);
    color: var(--bach-color-fg, currentColor);
    background: transparent;
    cursor: pointer;
    user-select: none;
    outline: none;
  }
  :host(:focus-visible) {
    box-shadow: 0 0 0 2px var(--bach-color-accent, dodgerblue);
  }
  :host(:hover) {
    background: color-mix(in oklch, currentcolor 12%, transparent);
  }
  button {
    all: unset;
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
  }
  svg { width: 60%; height: 60%; fill: currentColor; }
  .pause { display: none; }
  :host([data-playing]) .play { display: none; }
  :host([data-playing]) .pause { display: block; }
</style>
<button part="play-button" aria-label="Play">
  <svg class="play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
  <svg class="pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
</button>
`;

/**
 * `<bach-play-button>` — toggles play/pause on the host player. Reflects the
 * current paused state through a `data-playing` attribute, an aria-label
 * swap ("Play" / "Pause"), and two SVG icons whose visibility is driven
 * entirely from CSS.
 *
 * Stable parts: `play-button` (also serves as the pause-state surface; we
 * keep one part so user CSS doesn't have to fork). Consumers wanting
 * separate icons can target `:host([data-playing])::part(play-button)`.
 */
export class BachPlayButtonElement extends HTMLElement {
  #shadow: ShadowRoot;
  #button: HTMLButtonElement | null = null;
  #teardown: (() => void) | null = null;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open' });
    this.#shadow.innerHTML = TEMPLATE;
  }

  connectedCallback(): void {
    this.#button = this.#shadow.querySelector('button');
    this.tabIndex = this.tabIndex || 0;
    if (!this.hasAttribute('role')) this.setAttribute('role', 'button');

    this.#teardown = bindToBachHost(this, (host) => {
      const onActivate = (): void => {
        const v = host.video;
        if (!v) return;
        if (v.paused) v.play().catch(() => {});
        else v.pause();
      };

      const onKeyDown = (event: KeyboardEvent): void => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          onActivate();
        }
      };

      this.addEventListener('click', onActivate);
      this.addEventListener('keydown', onKeyDown);

      const stopEffect = effect(() => {
        const paused = host.state.paused.value;
        if (paused) this.removeAttribute('data-playing');
        else this.setAttribute('data-playing', '');
        const label = paused ? 'Play' : 'Pause';
        this.setAttribute('aria-label', label);
        this.#button?.setAttribute('aria-label', label);
      });

      return () => {
        this.removeEventListener('click', onActivate);
        this.removeEventListener('keydown', onKeyDown);
        stopEffect();
      };
    });
  }

  disconnectedCallback(): void {
    this.#teardown?.();
    this.#teardown = null;
  }
}
