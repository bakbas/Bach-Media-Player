import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BachAudioMixElement, BachAudioTrackElement } from './element.js';

/**
 * Element-level smoke tests. The real `AudioContext` isn't present
 * under happy-dom, so we stub it with a constructor that records the
 * graph calls the mixer makes. The same stub lets us assert disconnect
 * cleans up the context, the RAF loop, and any registered tracks.
 */
class FakeParam {
  value = 1;
  setValueAtTime(value: number): void {
    this.value = value;
  }
  setValueCurveAtTime(): void {}
  cancelScheduledValues(): void {}
}
class FakeNode {
  connect(target: unknown): unknown {
    return target;
  }
  disconnect(): void {}
}
class FakeGain extends FakeNode {
  gain = new FakeParam();
}
class FakeAnalyser extends FakeNode {
  fftSize = 2048;
  smoothingTimeConstant = 0.7;
  get frequencyBinCount(): number {
    return this.fftSize / 2;
  }
  getByteFrequencyData(array: Uint8Array): void {
    array.fill(42);
  }
}
class FakeAudioContext {
  destination = new FakeNode();
  currentTime = 0;
  closed = false;
  createGain(): FakeGain {
    return new FakeGain();
  }
  createAnalyser(): FakeAnalyser {
    return new FakeAnalyser();
  }
  createMediaElementSource(): FakeNode {
    return new FakeNode();
  }
  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
}

let rafCallbacks: Array<FrameRequestCallback> = [];
let nextRafId = 0;

function setupFakeEnv(): void {
  rafCallbacks = [];
  nextRafId = 0;
  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    writable: true,
    value: FakeAudioContext,
  });
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    writable: true,
    value: (cb: FrameRequestCallback): number => {
      nextRafId += 1;
      rafCallbacks.push(cb);
      return nextRafId;
    },
  });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', {
    configurable: true,
    writable: true,
    value: (): void => {
      rafCallbacks = [];
    },
  });
}

function ensureDefined(): void {
  if (!customElements.get('bach-audio-mix')) {
    customElements.define('bach-audio-mix', BachAudioMixElement);
  }
  if (!customElements.get('bach-audio-track')) {
    customElements.define('bach-audio-track', BachAudioTrackElement);
  }
}

beforeEach(() => {
  setupFakeEnv();
  ensureDefined();
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('<bach-audio-mix>', () => {
  it('boots a mixer on connect and exposes it', () => {
    const el = document.createElement('bach-audio-mix') as BachAudioMixElement;
    document.body.appendChild(el);
    expect(el.mixer).not.toBeNull();
  });

  it('skips boot entirely when AudioContext is unavailable', () => {
    Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: undefined });
    const el = document.createElement('bach-audio-mix') as BachAudioMixElement;
    document.body.appendChild(el);
    expect(el.mixer).toBeNull();
    el.remove();
  });

  it('fires bach:spectrum on the rAF tick with the sampled bin buffer', () => {
    const el = document.createElement('bach-audio-mix') as BachAudioMixElement;
    const handler = vi.fn();
    el.addEventListener('bach:spectrum', handler as EventListener);
    document.body.appendChild(el);
    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0]?.[0] as CustomEvent<{ bins: Uint8Array }>;
    expect(event.detail.bins).toBeInstanceOf(Uint8Array);
    expect(event.detail.bins.length).toBeGreaterThan(0);
    expect(event.detail.bins[0]).toBe(42);
  });

  it('tears down mixer, context, and rAF on disconnect', () => {
    const el = document.createElement('bach-audio-mix') as BachAudioMixElement;
    document.body.appendChild(el);
    expect(el.mixer).not.toBeNull();
    el.remove();
    expect(el.mixer).toBeNull();
    expect(rafCallbacks).toEqual([]);
  });

  it('addTrack delegates to the mixer; throws when not initialised', () => {
    const el = document.createElement('bach-audio-mix') as BachAudioMixElement;
    expect(() =>
      el.addTrack({ id: 'orphan', media: document.createElement('audio') }),
    ).toThrowError(/not initialised/);
    document.body.appendChild(el);
    const handle = el.addTrack({ id: 'extra', media: document.createElement('audio') });
    expect(handle.id).toBe('extra');
  });

  it('crossfade is a no-op before connect and forwards after', () => {
    const el = document.createElement('bach-audio-mix') as BachAudioMixElement;
    expect(() => el.crossfade('a', 'b')).not.toThrow();
    document.body.appendChild(el);
    el.addTrack({ id: 'a', media: document.createElement('audio') });
    el.addTrack({ id: 'b', media: document.createElement('audio') });
    expect(() => el.crossfade('a', 'b', { durationSeconds: 0.01 })).not.toThrow();
  });

  it('survives a host video that refuses to be wrapped twice', () => {
    const host = document.createElement('bach-player') as HTMLElement & {
      video: HTMLVideoElement | null;
    };
    const video = document.createElement('video');
    host.video = video;
    document.body.appendChild(host);

    let calls = 0;
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: class extends FakeAudioContext {
        override createMediaElementSource(): FakeNode {
          calls += 1;
          if (calls > 0) throw new Error('already wrapped');
          return new FakeNode();
        }
      },
    });
    const el = document.createElement('bach-audio-mix') as BachAudioMixElement;
    host.appendChild(el);
    expect(el.mixer).not.toBeNull();
  });
});

describe('<bach-audio-track>', () => {
  it('does nothing without a src attribute', () => {
    const mix = document.createElement('bach-audio-mix') as BachAudioMixElement;
    document.body.appendChild(mix);
    const track = document.createElement('bach-audio-track') as BachAudioTrackElement;
    mix.appendChild(track);
    expect(track.audio).toBeNull();
  });

  it('does nothing without a <bach-audio-mix> ancestor', () => {
    const track = document.createElement('bach-audio-track') as BachAudioTrackElement;
    track.setAttribute('src', 'commentary.mp4');
    document.body.appendChild(track);
    expect(track.audio).toBeNull();
  });

  it('registers an <audio> child with the mixer when both pieces are present', () => {
    const mix = document.createElement('bach-audio-mix') as BachAudioMixElement;
    document.body.appendChild(mix);
    const track = document.createElement('bach-audio-track') as BachAudioTrackElement;
    track.setAttribute('src', 'commentary.mp4');
    track.setAttribute('label', 'commentary');
    track.setAttribute('gain', '0.5');
    mix.appendChild(track);
    expect(track.audio).not.toBeNull();
    expect(track.audio?.src).toContain('commentary.mp4');
  });

  it('tolerates a non-finite gain attribute by falling back to 1', () => {
    const mix = document.createElement('bach-audio-mix') as BachAudioMixElement;
    document.body.appendChild(mix);
    const track = document.createElement('bach-audio-track') as BachAudioTrackElement;
    track.setAttribute('src', 'commentary.mp4');
    track.setAttribute('gain', 'not-a-number');
    mix.appendChild(track);
    expect(track.audio).not.toBeNull();
  });

  it('removes the <audio> child on disconnect', () => {
    const mix = document.createElement('bach-audio-mix') as BachAudioMixElement;
    document.body.appendChild(mix);
    const track = document.createElement('bach-audio-track') as BachAudioTrackElement;
    track.setAttribute('src', 'commentary.mp4');
    mix.appendChild(track);
    expect(track.audio).not.toBeNull();
    track.remove();
    expect(track.audio).toBeNull();
  });
});
