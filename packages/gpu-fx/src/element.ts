import { type Effect, mergeChains } from './effects.js';
import { PRESETS, type PresetName } from './presets.js';

/**
 * `<bach-gpu-fx preset="cinematic">` — declarative entry point for the
 * Akustik signature. The element does not own the WebGPU pipeline
 * itself; it owns the active effect chain. Consumers wire the chain
 * to a runtime via the `bach:gpu-fx-chain` event (or a future
 * autoinstall path once the pipeline ships).
 *
 * Two ways to drive it:
 *
 *   <bach-gpu-fx preset="cinematic"></bach-gpu-fx>
 *
 *   const el = document.querySelector('bach-gpu-fx')!;
 *   el.setChain([{ type: 'color-grade', exposure: 1.05 }, ...]);
 *
 * Combining them merges the preset with the explicit chain (preset
 * first, user tweaks last) via `mergeChains` from `effects.ts`.
 */
export class BachGpuFxElement extends HTMLElement {
  static get observedAttributes(): readonly string[] {
    return ['preset', 'disabled'];
  }

  #explicitChain: ReadonlyArray<Effect> = [];

  /** Currently-effective chain (preset + explicit, normalised). */
  get chain(): ReadonlyArray<Effect> {
    if (this.hasAttribute('disabled')) return [];
    const preset = this.#resolvePreset();
    return mergeChains(preset, this.#explicitChain);
  }

  /** Replace the explicit user chain. Triggers a `bach:gpu-fx-chain` event. */
  setChain(chain: ReadonlyArray<Effect>): void {
    this.#explicitChain = chain;
    this.#emit();
  }

  attributeChangedCallback(): void {
    this.#emit();
  }

  connectedCallback(): void {
    this.#emit();
  }

  #resolvePreset(): ReadonlyArray<Effect> | undefined {
    const value = this.getAttribute('preset');
    if (!value) return undefined;
    if (value in PRESETS) return PRESETS[value as PresetName];
    return undefined;
  }

  #emit(): void {
    this.dispatchEvent(
      new CustomEvent('bach:gpu-fx-chain', {
        bubbles: true,
        composed: true,
        detail: { chain: this.chain },
      }),
    );
  }
}
