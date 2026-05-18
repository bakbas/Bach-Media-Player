const TEMPLATE = `
<style>
  :host {
    display: flex;
    width: 100%;
    align-items: center;
    gap: var(--bach-control-gap, 8px);
    padding: var(--bach-control-gap, 8px);
    color: var(--bach-color-fg, white);
    background: var(--bach-overlay-bg, color-mix(in oklch, black 65%, transparent));
    backdrop-filter: blur(var(--bach-overlay-blur, 0));
    -webkit-backdrop-filter: blur(var(--bach-overlay-blur, 0));
    font: inherit;
  }
  ::slotted(bach-progress) { flex: 1; }
  ::slotted(*) { flex: none; }
</style>
<slot></slot>
`;

/**
 * `<bach-controls>` — bare container for slotted control elements. Provides
 * the layout (flex row with gap), the chrome background, and the `chrome`
 * part. Consumers can either use this element directly (filling it with
 * the children they want) or build their own container — the slotted
 * controls do not depend on it.
 *
 * Default layout when used with no children:
 *
 *   <bach-controls>
 *     <bach-play-button></bach-play-button>
 *     <bach-progress></bach-progress>
 *     <bach-time></bach-time>
 *     <bach-volume></bach-volume>
 *     <bach-fullscreen-button></bach-fullscreen-button>
 *   </bach-controls>
 */
export class BachControlsElement extends HTMLElement {
  #shadow: ShadowRoot;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open' });
    this.#shadow.innerHTML = TEMPLATE;
    if (!this.getAttribute('part')) this.setAttribute('part', 'chrome');
  }
}
