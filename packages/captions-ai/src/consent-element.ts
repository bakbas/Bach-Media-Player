import { type PermissionResolution, resolvePermission, writePermission } from './permission.js';
import { type ModelCacheProbe, WHISPER_MODELS, type WhisperModelKey } from './whisper.js';

const TEMPLATE = `
<style>
  :host {
    position: absolute;
    inset: 0;
    display: none;
    align-items: center;
    justify-content: center;
    background: var(--bach-overlay-bg, color-mix(in oklch, black 65%, transparent));
    backdrop-filter: blur(var(--bach-overlay-blur, 6px));
    -webkit-backdrop-filter: blur(var(--bach-overlay-blur, 6px));
    z-index: 2;
  }
  :host([open]) { display: flex; }
  .card {
    background: var(--bach-color-bg, oklch(0.16 0 0));
    color: var(--bach-color-fg, white);
    border-radius: var(--bach-radius, 12px);
    padding: 24px;
    max-width: 360px;
    text-align: center;
    font: inherit;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }
  h2 {
    margin: 0 0 8px;
    font-size: 1.05rem;
    font-weight: 600;
  }
  p { margin: 0 0 8px; line-height: 1.4; opacity: 0.9; }
  .size { font-variant-numeric: tabular-nums; opacity: 0.8; }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
    justify-content: center;
  }
  button {
    all: unset;
    cursor: pointer;
    padding: 8px 16px;
    border-radius: var(--bach-radius, 6px);
    font: inherit;
    text-align: center;
  }
  button.primary {
    background: var(--bach-color-accent, oklch(0.7 0.18 250));
    color: var(--bach-color-bg, black);
  }
  button.secondary {
    border: 1px solid color-mix(in oklch, currentcolor 25%, transparent);
  }
  button:focus-visible {
    box-shadow: 0 0 0 2px var(--bach-color-accent, dodgerblue);
  }
  progress {
    width: 100%;
    margin-top: 12px;
    accent-color: var(--bach-color-accent, dodgerblue);
  }
  .progress-text { font-size: 0.85rem; opacity: 0.8; margin-top: 4px; }
  :host([state="loading"]) .actions { display: none; }
  :host([state="ready"]) .progress-row { display: none; }
  :host([state="idle"]) .progress-row { display: none; }
</style>
<div class="card" part="consent-card" role="dialog" aria-modal="true" aria-labelledby="t">
  <h2 id="t" part="consent-heading">
    <slot name="heading">Enable AI captions?</slot>
  </h2>
  <p part="consent-body">
    <slot name="body">
      Bach can transcribe this video in your browser using an open-source
      speech model. Your audio never leaves the device.
    </slot>
  </p>
  <p class="size" part="consent-size">
    Download size: <span class="size-value">~</span> MB
  </p>
  <div class="actions">
    <button class="secondary" part="consent-decline" type="button">
      <slot name="decline">Not now</slot>
    </button>
    <button class="primary" part="consent-accept" type="button">
      <slot name="accept">Enable</slot>
    </button>
  </div>
  <div class="progress-row" part="consent-progress">
    <progress max="100" value="0"></progress>
    <div class="progress-text">Preparing…</div>
  </div>
</div>
`;

export interface CaptionsConsentResolveEvent {
  decision: 'granted' | 'denied' | 'cached';
  model: WhisperModelKey;
}

/**
 * `<bach-captions-consent>` — explicit opt-in dialog before downloading the
 * Whisper model. The element is dormant (`display: none`) until `open()` is
 * called or the `open` attribute is set. On user choice it persists the
 * decision via the permission store and dispatches `bach:captions-consent`.
 *
 * The element does not itself load the model — it just gates the decision.
 * Consumers listen for the `granted` event and then construct a
 * `createWhisperEngine` with the same `onProgress` callback wired through
 * `setProgress()` to drive the progress bar.
 */
export class BachCaptionsConsentElement extends HTMLElement {
  static get observedAttributes(): readonly string[] {
    return ['model', 'open'];
  }

  #shadow: ShadowRoot;
  #model: WhisperModelKey = 'tiny';
  #probe: ModelCacheProbe | null = null;
  #cancelled = false;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open' });
    this.#shadow.innerHTML = TEMPLATE;
  }

  connectedCallback(): void {
    const accept = this.#shadow.querySelector<HTMLButtonElement>('button.primary');
    const decline = this.#shadow.querySelector<HTMLButtonElement>('button.secondary');
    accept?.addEventListener('click', () => this.#resolve('granted'));
    decline?.addEventListener('click', () => this.#resolve('denied'));
    if (!this.hasAttribute('state')) this.setAttribute('state', 'idle');
    this.#renderSize();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === 'model' && value && value in WHISPER_MODELS) {
      this.#model = value as WhisperModelKey;
      this.#renderSize();
    }
  }

  /** Inject a cache probe (defaults to the Cache API one in tests). */
  setCacheProbe(probe: ModelCacheProbe | null): void {
    this.#probe = probe;
  }

  /**
   * Compute the permission state and surface UI accordingly. Returns the
   * resolution so callers can short-circuit. The element is set to `open`
   * only when a prompt is actually required (state `unknown`).
   */
  async resolve(): Promise<PermissionResolution> {
    const result = await resolvePermission(this.#model, this.#probe ?? undefined);
    if (result.state === 'cached' || result.state === 'granted') {
      this.removeAttribute('open');
      this.setAttribute('state', 'ready');
    } else if (result.state === 'denied') {
      this.removeAttribute('open');
      this.setAttribute('state', 'idle');
    } else {
      this.setAttribute('open', '');
      this.setAttribute('state', 'idle');
    }
    return result;
  }

  /** Update the progress bar (0..1). Switches to the `loading` state. */
  setProgress(fraction: number): void {
    this.setAttribute('state', 'loading');
    const bar = this.#shadow.querySelector<HTMLProgressElement>('progress');
    if (bar) bar.value = Math.max(0, Math.min(100, fraction * 100));
    const text = this.#shadow.querySelector<HTMLElement>('.progress-text');
    if (text) text.textContent = `${Math.round(fraction * 100)}%`;
  }

  /** Mark the model as ready and hide the dialog. */
  setReady(): void {
    if (this.#cancelled) return;
    this.setAttribute('state', 'ready');
    this.removeAttribute('open');
  }

  #renderSize(): void {
    const info = WHISPER_MODELS[this.#model];
    const sizeMb = Math.ceil(info.sizeBytes / (1024 * 1024));
    const value = this.#shadow.querySelector('.size-value');
    if (value) value.textContent = String(sizeMb);
  }

  #resolve(decision: 'granted' | 'denied'): void {
    writePermission(decision);
    this.removeAttribute('open');
    if (decision === 'denied') this.#cancelled = true;
    this.dispatchEvent(
      new CustomEvent<CaptionsConsentResolveEvent>('bach:captions-consent', {
        bubbles: true,
        composed: true,
        detail: { decision, model: this.#model },
      }),
    );
  }
}
