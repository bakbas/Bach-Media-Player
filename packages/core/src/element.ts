import { type PlayerState, createPlayerState } from './state.js';

const OBSERVED_ATTRIBUTES = ['src', 'autoplay', 'muted', 'headless', 'theme'] as const;

export class BachPlayerElement extends HTMLElement {
  readonly state: PlayerState;
  #shadow: ShadowRoot;
  #video: HTMLVideoElement | null = null;

  static get observedAttributes(): readonly string[] {
    return OBSERVED_ATTRIBUTES;
  }

  constructor() {
    super();
    this.state = createPlayerState({
      src: this.getAttribute('src'),
      muted: this.hasAttribute('muted'),
      headless: this.hasAttribute('headless'),
    });
    this.#shadow = this.attachShadow({ mode: 'open' });
    this.#shadow.innerHTML = TEMPLATE;
  }

  connectedCallback(): void {
    this.#video = this.querySelector<HTMLVideoElement>('video[slot="media"]');
    if (this.state.headless.value) {
      this.setAttribute('headless', '');
    }
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    switch (name) {
      case 'src':
        this.state.src.value = value;
        break;
      case 'muted':
        this.state.muted.value = value !== null;
        break;
      case 'headless':
        this.state.headless.value = value !== null;
        break;
      default:
        break;
    }
  }

  get video(): HTMLVideoElement | null {
    return this.#video;
  }
}

const TEMPLATE = `
<style>
  :host {
    display: block;
    position: relative;
    contain: layout paint;
    background: var(--bach-color-bg, oklch(0.18 0 0));
    color: var(--bach-color-fg, oklch(0.96 0 0));
    border-radius: var(--bach-radius, 0);
    font-family: var(--bach-font-family, system-ui, sans-serif);
    font-size: var(--bach-font-size, 14px);
    overflow: hidden;
  }
  :host([headless]) ::slotted([slot="controls"]),
  :host([headless]) ::slotted([slot="overlay"]) {
    display: none !important;
  }
  .media-stage { position: relative; width: 100%; height: 100%; }
  .chrome {
    position: absolute;
    inset: auto 0 0 0;
    display: flex;
    gap: var(--bach-control-gap, 8px);
    padding: var(--bach-control-gap, 8px);
  }
</style>
<div class="media-stage" part="chrome">
  <slot name="media"></slot>
  <div class="chrome" part="chrome">
    <slot name="controls"></slot>
  </div>
  <slot name="overlay"></slot>
  <slot></slot>
</div>
`;
