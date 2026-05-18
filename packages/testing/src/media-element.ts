export interface FakeMediaElementOptions {
  duration?: number;
  initialTime?: number;
  buffered?: ReadonlyArray<[number, number]>;
}

type Listener = (event: Event) => void;

/**
 * Minimal HTMLMediaElement-shaped fake for unit tests. We do not extend
 * HTMLMediaElement (constructing one in jsdom/happy-dom is unreliable);
 * instead we mirror the surface our code actually reads.
 */
export class FakeMediaElement {
  duration: number;
  currentTime: number;
  paused = true;
  muted = false;
  volume = 1;
  readyState = 0;
  error: { code: number; message: string } | null = null;
  #buffered: ReadonlyArray<[number, number]>;
  #listeners = new Map<string, Set<Listener>>();

  constructor(opts: FakeMediaElementOptions = {}) {
    this.duration = opts.duration ?? Number.NaN;
    this.currentTime = opts.initialTime ?? 0;
    this.#buffered = opts.buffered ?? [];
  }

  get buffered(): { length: number; start(i: number): number; end(i: number): number } {
    const ranges = this.#buffered;
    return {
      length: ranges.length,
      start(i: number): number {
        const r = ranges[i];
        if (!r) throw new RangeError(`buffered.start(${i}) out of range`);
        return r[0];
      },
      end(i: number): number {
        const r = ranges[i];
        if (!r) throw new RangeError(`buffered.end(${i}) out of range`);
        return r[1];
      },
    };
  }

  addEventListener(type: string, handler: Listener): void {
    let set = this.#listeners.get(type);
    if (!set) {
      set = new Set();
      this.#listeners.set(type, set);
    }
    set.add(handler);
  }

  removeEventListener(type: string, handler: Listener): void {
    this.#listeners.get(type)?.delete(handler);
  }

  dispatch(type: string, init: EventInit = {}): void {
    const event = new Event(type, init);
    for (const handler of this.#listeners.get(type) ?? []) handler(event);
  }

  async play(): Promise<void> {
    this.paused = false;
    this.dispatch('play');
  }

  pause(): void {
    this.paused = true;
    this.dispatch('pause');
  }
}
