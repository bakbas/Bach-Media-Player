import type { BachPlayerElement } from '@bach/core';
import { type Mixer, createMixer } from './mixer.js';

/**
 * `<bach-audio-mix>` — owns an AudioContext + Mixer for the host
 * player. Child `<bach-audio-track>` elements register themselves as
 * tracks on connection; the host player's video stays the default
 * master.
 *
 * The element is intentionally non-visual. A presentational spectral
 * analyzer overlay (the visible "Polifoni" surface in the playground)
 * subscribes to `bach:spectrum` events the mixer fires on every
 * animation frame the element is connected.
 */
export class BachAudioMixElement extends HTMLElement {
  #mixer: Mixer | null = null;
  #rafId: number | null = null;
  #spectrumBuffer: Uint8Array | null = null;
  #context: AudioContext | null = null;

  get mixer(): Mixer | null {
    return this.#mixer;
  }

  connectedCallback(): void {
    if (typeof AudioContext === 'undefined') return;
    const host = this.closest<BachPlayerElement>('bach-player');
    this.#context = new AudioContext();
    this.#mixer = createMixer({ context: this.#context });

    if (host?.video) {
      try {
        this.#mixer.addTrack({ id: 'main', media: host.video });
      } catch {
        // Some browsers refuse to wrap the same <video> twice; ignore
        // silently because the consumer can register a different
        // master via setGain('main', ...) if they need to.
      }
    }

    this.#tick();
  }

  disconnectedCallback(): void {
    if (this.#rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
    this.#mixer?.dispose();
    this.#mixer = null;
    if (this.#context && typeof this.#context.close === 'function') {
      void this.#context.close();
    }
    this.#context = null;
  }

  /**
   * Register an arbitrary track. Returns the underlying TrackHandle so
   * the caller can drive setGain / crossfade or read the spectral data.
   */
  addTrack(input: Parameters<NonNullable<typeof this.mixer>['addTrack']>[0]) {
    if (!this.#mixer) throw new Error('bach-audio-mix: mixer not initialised');
    return this.#mixer.addTrack(input);
  }

  /** Convenience: crossfade between two registered tracks. */
  crossfade(
    fromId: string,
    toId: string,
    opts?: Parameters<NonNullable<typeof this.mixer>['crossfade']>[2],
  ): void {
    this.#mixer?.crossfade(fromId, toId, opts);
  }

  #tick = (): void => {
    if (!this.#mixer) return;
    this.#spectrumBuffer ??= new Uint8Array(this.#mixer.analyser.frequencyBinCount);
    this.#mixer.sampleSpectrum(this.#spectrumBuffer);
    this.dispatchEvent(
      new CustomEvent('bach:spectrum', {
        bubbles: true,
        composed: true,
        detail: { bins: this.#spectrumBuffer },
      }),
    );
    if (typeof requestAnimationFrame === 'function') {
      this.#rafId = requestAnimationFrame(this.#tick);
    }
  };
}

/**
 * `<bach-audio-track src="..." label="...">` — declarative track input.
 * The element creates an `<audio>` element under the hood and registers
 * itself with the closest `<bach-audio-mix>` ancestor on connect.
 */
export class BachAudioTrackElement extends HTMLElement {
  static get observedAttributes(): readonly string[] {
    return ['src', 'label', 'gain'];
  }

  #audio: HTMLAudioElement | null = null;

  get audio(): HTMLAudioElement | null {
    return this.#audio;
  }

  connectedCallback(): void {
    const src = this.getAttribute('src');
    if (!src) return;
    const mix = this.closest<BachAudioMixElement>('bach-audio-mix');
    if (!mix) return;
    const audio = document.createElement('audio');
    audio.src = src;
    audio.crossOrigin = this.getAttribute('crossorigin') ?? 'anonymous';
    audio.preload = 'metadata';
    audio.style.display = 'none';
    this.appendChild(audio);
    this.#audio = audio;

    const id = this.id || this.getAttribute('label') || src;
    const gain = Number.parseFloat(this.getAttribute('gain') ?? '1');
    try {
      mix.addTrack({ id, media: audio, gain: Number.isFinite(gain) ? gain : 1 });
    } catch {
      // Duplicate id or unsupported source — leave as a render-only node.
    }
  }

  disconnectedCallback(): void {
    this.#audio?.pause();
    this.#audio?.remove();
    this.#audio = null;
  }
}
