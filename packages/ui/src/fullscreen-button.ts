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
    cursor: pointer;
    outline: none;
  }
  :host(:focus-visible) { box-shadow: 0 0 0 2px var(--bach-color-accent, dodgerblue); }
  :host(:hover) { background: color-mix(in oklch, currentcolor 12%, transparent); }
  button { all: unset; display: flex; width: 100%; height: 100%; align-items: center; justify-content: center; }
  svg { width: 60%; height: 60%; fill: currentColor; }
  .exit { display: none; }
  :host([data-fullscreen]) .enter { display: none; }
  :host([data-fullscreen]) .exit { display: block; }
</style>
<button part="fullscreen-button" aria-label="Enter fullscreen">
  <svg class="enter" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h6V3H3v8h2V5zm14 0v6h2V3h-8v2h6zM5 19v-6H3v8h8v-2H5zm14 0h-6v2h8v-8h-2v6z"/></svg>
  <svg class="exit" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h4V5h2v6H5V9zm10 0V5h-2v6h6V9h-4zm0 6h4v-2h-6v6h2v-4zm-10 0H1v-2h6v6H5v-4z"/></svg>
</button>
`;

type WebkitFullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => void;
};
type WebkitFullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};

/**
 * `<bach-fullscreen-button>` — toggles browser fullscreen on the host
 * player element. Falls back to the `webkitRequestFullscreen` family for
 * Safari < 16.4. Listens for the `fullscreenchange` event so the data
 * attribute and aria-label stay in sync if the user exits via Esc.
 */
export class BachFullscreenButtonElement extends HTMLElement {
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
    if (this.tabIndex < 0) this.tabIndex = 0;
    if (!this.hasAttribute('role')) this.setAttribute('role', 'button');

    this.#teardown = bindToBachHost(this, (host) => {
      const isFullscreen = (): boolean => {
        const doc = document as WebkitFullscreenDocument;
        return Boolean(document.fullscreenElement ?? doc.webkitFullscreenElement);
      };

      const enter = (): void => {
        const target = host as unknown as WebkitFullscreenElement;
        const promise = target.requestFullscreen?.();
        if (promise && typeof promise.catch === 'function') {
          promise.catch(() => {
            target.webkitRequestFullscreen?.();
          });
        } else {
          target.webkitRequestFullscreen?.();
        }
      };

      const exit = (): void => {
        const doc = document as WebkitFullscreenDocument;
        const result = document.exitFullscreen?.();
        if (result && typeof result.catch === 'function') {
          result.catch(() => doc.webkitExitFullscreen?.());
        } else {
          doc.webkitExitFullscreen?.();
        }
      };

      const updateState = (): void => {
        const fs = isFullscreen();
        if (fs) this.setAttribute('data-fullscreen', '');
        else this.removeAttribute('data-fullscreen');
        const label = fs ? 'Exit fullscreen' : 'Enter fullscreen';
        this.setAttribute('aria-label', label);
        this.#button?.setAttribute('aria-label', label);
      };

      const onActivate = (): void => {
        if (isFullscreen()) exit();
        else enter();
      };

      const onKeyDown = (event: KeyboardEvent): void => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          onActivate();
        }
      };

      this.addEventListener('click', onActivate);
      this.addEventListener('keydown', onKeyDown);
      document.addEventListener('fullscreenchange', updateState);
      document.addEventListener('webkitfullscreenchange', updateState);
      updateState();

      return () => {
        this.removeEventListener('click', onActivate);
        this.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('fullscreenchange', updateState);
        document.removeEventListener('webkitfullscreenchange', updateState);
      };
    });
  }

  disconnectedCallback(): void {
    this.#teardown?.();
    this.#teardown = null;
  }
}
