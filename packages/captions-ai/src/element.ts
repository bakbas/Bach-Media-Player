import type { BachPlayerElement } from '@bach/core';
import { effect } from '@preact/signals-core';
import { type Segment, activeSegmentAt, createTimingAligner } from './timing-aligner.js';

const TEMPLATE = `
<style>
  :host {
    position: absolute;
    inset: auto 0 var(--bach-captions-bottom, 16%) 0;
    display: flex;
    justify-content: center;
    pointer-events: none;
  }
  :host([hidden]) { display: none; }
  .cue {
    padding: 6px 12px;
    border-radius: var(--bach-radius, 4px);
    background: var(--bach-captions-bg, color-mix(in oklch, black 65%, transparent));
    color: var(--bach-captions-fg, white);
    font-family: var(--bach-font-family, system-ui, sans-serif);
    font-size: var(--bach-captions-size, 1.5rem);
    line-height: 1.3;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    max-width: 80%;
    text-align: center;
  }
  .cue:empty { display: none; }
</style>
<div class="cue" part="caption-cue" aria-live="polite"></div>
`;

function findBachPlayer(el: Element): BachPlayerElement | null {
  let cursor: Element | null = el;
  while (cursor) {
    const found = cursor.closest<BachPlayerElement>('bach-player');
    if (found) return found;
    const root = cursor.getRootNode();
    cursor = root instanceof ShadowRoot ? root.host : null;
  }
  return null;
}

/**
 * `<bach-captions>` — overlays the active transcribed segment on top of the
 * host player and (optionally) injects a `<track kind="captions">` into the
 * underlying `<video>` so screen readers and native player chrome surface
 * the same text. Sources of segments are pluggable: this element does not
 * own the transcription pipeline, it consumes a stream via `setSegments()`.
 */
export class BachCaptionsElement extends HTMLElement {
  #shadow: ShadowRoot;
  #cue: HTMLElement | null = null;
  #teardown: (() => void) | null = null;
  #aligner = createTimingAligner();
  #track: TextTrack | null = null;
  #injectedTrackElement: HTMLTrackElement | null = null;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open' });
    this.#shadow.innerHTML = TEMPLATE;
  }

  connectedCallback(): void {
    this.#cue = this.#shadow.querySelector('.cue');
    const host = findBachPlayer(this);
    if (!host) return;

    const stop = effect(() => {
      const t = host.state.currentTime.value;
      const active = activeSegmentAt(this.#aligner.all, t);
      if (this.#cue) this.#cue.textContent = active?.text ?? '';
    });

    this.#injectTrack(host);

    this.#teardown = (): void => {
      stop();
      this.#removeTrack();
    };
  }

  disconnectedCallback(): void {
    this.#teardown?.();
    this.#teardown = null;
    this.#aligner.reset();
  }

  /**
   * Push one window's worth of segments into the aligner. Duplicates from
   * overlapping windows are dropped — see `timing-aligner.ts`. Newly retained
   * segments are also mirrored into the injected TextTrack so the native UA
   * captions menu reflects them.
   */
  setSegments(segments: ReadonlyArray<Segment>): void {
    const fresh = this.#aligner.ingest(segments);
    if (this.#track && fresh.length > 0) {
      for (const seg of fresh) {
        try {
          const cue = new VTTCue(seg.start, seg.end, seg.text);
          this.#track.addCue(cue);
        } catch {
          // VTTCue not constructible (older browsers): silently drop the
          // mirror; the visual overlay still renders from #aligner.all.
        }
      }
    }
  }

  /** Drop every retained segment — call this on `seeked` or `src` change. */
  reset(): void {
    this.#aligner.reset();
    if (this.#track) {
      // TextTrack has no removeCue-all primitive; iterate the live list.
      while (this.#track.cues && this.#track.cues.length > 0) {
        const c = this.#track.cues[0];
        if (c) this.#track.removeCue(c);
      }
    }
  }

  get segments(): ReadonlyArray<Segment> {
    return this.#aligner.all;
  }

  #injectTrack(host: BachPlayerElement): void {
    const video = host.video;
    if (!video) return;
    const track = document.createElement('track');
    track.kind = 'captions';
    track.label = this.getAttribute('label') ?? 'AI captions';
    track.srclang = this.getAttribute('language') ?? 'auto';
    track.default = true;
    video.appendChild(track);
    this.#injectedTrackElement = track;
    // `track.track` is populated synchronously when the element is in the DOM.
    this.#track = track.track ?? null;
    if (this.#track) this.#track.mode = 'hidden';
  }

  #removeTrack(): void {
    this.#injectedTrackElement?.remove();
    this.#injectedTrackElement = null;
    this.#track = null;
  }
}
