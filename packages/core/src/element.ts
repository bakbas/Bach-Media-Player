import { type PlayerState, createPlayerState } from './state.js';
import { type ApplyThemeResult, applyTheme } from './theme.js';
import { bindVideoToState } from './video-binding.js';

const OBSERVED_ATTRIBUTES = ['src', 'autoplay', 'muted', 'headless', 'theme'] as const;

/**
 * `<bach-player>` Custom Element. Slot-based composition (Media Chrome
 * pattern): callers provide a `<video slot="media">` and any chrome they
 * want via additional slots. The element only wires the video element to
 * the signals state and exposes the imperative API — engines plug in via
 * the public state contract (Phase 1, Sprint 3).
 */
export class BachPlayerElement extends HTMLElement {
  readonly state: PlayerState;
  #shadow: ShadowRoot;
  #video: HTMLVideoElement | null = null;
  #unbindVideo: (() => void) | null = null;
  #slotChangeListener: (() => void) | null = null;

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
    if (this.state.headless.value) {
      this.setAttribute('headless', '');
    }
    this.#attachVideoFromSlot();

    const mediaSlot = this.#shadow.querySelector<HTMLSlotElement>('slot[name="media"]');
    if (mediaSlot) {
      const listener = (): void => this.#attachVideoFromSlot();
      mediaSlot.addEventListener('slotchange', listener);
      this.#slotChangeListener = (): void => mediaSlot.removeEventListener('slotchange', listener);
    }
  }

  disconnectedCallback(): void {
    this.#unbindVideo?.();
    this.#unbindVideo = null;
    this.#slotChangeListener?.();
    this.#slotChangeListener = null;
    this.#video = null;
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    switch (name) {
      case 'src':
        this.state.src.value = value;
        break;
      case 'muted':
        this.state.muted.value = value !== null;
        if (this.#video) this.#video.muted = value !== null;
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

  /**
   * Apply a theme manifest at runtime. Validates the manifest against the
   * public token contract and applies only the keys that pass — see
   * `applyTheme` in `theme.ts` for the full security model.
   */
  applyTheme(manifest: unknown): ApplyThemeResult {
    return applyTheme(this, manifest);
  }

  #attachVideoFromSlot(): void {
    const next = this.querySelector<HTMLVideoElement>('video[slot="media"]');
    if (next === this.#video) return;

    this.#unbindVideo?.();
    this.#unbindVideo = null;
    this.#video = next;
    if (next) this.#unbindVideo = bindVideoToState(next, this.state);
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
