import type { BachPlayerElement } from '@bach/core';
import type { FrameStepper } from './frame-stepper.js';

/**
 * `<bach-seek-frame>` — opt-in element that wires a `FrameStepper` to the
 * host player and surfaces the four step primitives as DOM-level methods
 * and keyboard shortcuts. The element does no decoding itself; consumers
 * pass the stepper they constructed (with MP4Box source + WebCodecs
 * decoder, or the currentTime fallback).
 *
 * Keyboard shortcuts when the host has focus: comma / period — prev/next
 * frame, matching the convention used by ffplay and Resolve.
 *
 * Events:
 *   - `bach:frame` — fires after every successful step / at(); detail
 *      `{ frame, position }` where `frame` is the decoded payload.
 *
 * The element is intentionally non-visual; consumers compose it inside a
 * `<bach-player>` and rely on their own UI (or `<bach-controls>`) for the
 * presentational surface.
 */
export class BachSeekFrameElement extends HTMLElement {
  #stepper: FrameStepper | null = null;
  #teardown: (() => void) | null = null;

  /** Attach the stepper that backs this element. */
  setStepper(stepper: FrameStepper | null): void {
    this.#stepper = stepper;
  }

  get stepper(): FrameStepper | null {
    return this.#stepper;
  }

  connectedCallback(): void {
    const host = this.closest<BachPlayerElement>('bach-player');
    if (!host) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (!this.#stepper) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === ',') {
        event.preventDefault();
        void this.prev();
      } else if (event.key === '.') {
        event.preventDefault();
        void this.next();
      }
    };

    host.addEventListener('keydown', onKeyDown);
    this.#teardown = (): void => {
      host.removeEventListener('keydown', onKeyDown);
    };
  }

  disconnectedCallback(): void {
    this.#teardown?.();
    this.#teardown = null;
  }

  async at(time: number): Promise<unknown | null> {
    return this.#emit(await this.#stepper?.at(time));
  }
  async step(delta: number): Promise<unknown | null> {
    return this.#emit(await this.#stepper?.step(delta));
  }
  prev(): Promise<unknown | null> {
    return this.step(-1);
  }
  next(): Promise<unknown | null> {
    return this.step(1);
  }

  #emit(frame: unknown | null | undefined): unknown | null {
    if (frame === undefined) return null;
    this.dispatchEvent(
      new CustomEvent('bach:frame', {
        bubbles: true,
        composed: true,
        detail: { frame, position: this.#stepper?.position ?? -1 },
      }),
    );
    return frame;
  }
}
