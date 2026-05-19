import { describe, expect, it, vi } from 'vitest';
import type { DecoderController, EncodedVideoChunkLike } from './decoder.js';
import { createFrameCache } from './frame-cache.js';
import { createCurrentTimeFallback, createFrameStepper } from './frame-stepper.js';
import { type Frame, createKeyframeIndex } from './keyframe-index.js';

const f = (pts: number, sync = false, duration = 0.1): Frame => ({
  dts: pts,
  pts,
  duration,
  sync,
  offset: 0,
  size: 0,
});

// GOP: K _ _ K _ _ K _
const samples = [f(0, true), f(0.1), f(0.2), f(0.3, true), f(0.4), f(0.5), f(0.6, true), f(0.7)];

function fakeDecoder(): DecoderController {
  return {
    configure() {},
    decode(_chunk: EncodedVideoChunkLike, pts: number) {
      return Promise.resolve({ pts, value: `frame@${pts.toFixed(2)}`, bytes: 100 });
    },
    flush: () => Promise.resolve(),
    reset: vi.fn(),
    close() {},
    state: 'configured' as const,
    queueSize: 0,
  };
}

describe('createFrameStepper', () => {
  function setup() {
    const index = createKeyframeIndex(samples);
    const decoder = fakeDecoder();
    const cache = createFrameCache<unknown>({ maxBytes: 1024 * 1024 });
    const fetchSampleBytes = vi.fn(async (_: Frame) => new Uint8Array([0]));
    const toChunk = vi.fn(
      (frame: Frame): EncodedVideoChunkLike => ({
        type: frame.sync ? 'key' : 'delta',
        timestamp: frame.pts * 1e6,
        duration: frame.duration * 1e6,
        byteLength: 1,
      }),
    );
    const stepper = createFrameStepper({
      index,
      decoder,
      cache,
      fetchSampleBytes,
      toChunk,
    });
    return { index, decoder, cache, stepper, fetchSampleBytes, toChunk };
  }

  it('seeks to a time and returns the decoded value', async () => {
    const { stepper } = setup();
    const v = await stepper.at(0.45);
    expect(v).toBe('frame@0.40');
    expect(stepper.position).toBe(4);
  });

  it('replays the whole GOP from the preceding keyframe', async () => {
    const { stepper, fetchSampleBytes } = setup();
    await stepper.at(0.5);
    // GOP starts at pts=0.3 (keyframe), runs through 0.4 and 0.5.
    const calls = fetchSampleBytes.mock.calls.map((c) => c[0].pts);
    expect(calls).toEqual([0.3, 0.4, 0.5]);
  });

  it('hits the cache on a second visit and skips the decoder', async () => {
    const { stepper, decoder, cache, fetchSampleBytes } = setup();
    await stepper.at(0.4);
    fetchSampleBytes.mockClear();
    (decoder.reset as ReturnType<typeof vi.fn>).mockClear();
    const v = await stepper.at(0.4);
    expect(v).toBe('frame@0.40');
    expect(fetchSampleBytes).not.toHaveBeenCalled();
    // GOP for pts=0.4 starts at keyframe pts=0.3 → two frames cached.
    expect(cache.size).toBe(2);
  });

  it('step(+1) advances to the next sample', async () => {
    const { stepper } = setup();
    await stepper.at(0.3);
    const v = await stepper.next();
    expect(v).toBe('frame@0.40');
    expect(stepper.position).toBe(4);
  });

  it('step(-1) walks back across a GOP boundary', async () => {
    const { stepper } = setup();
    await stepper.at(0.3);
    const v = await stepper.prev();
    // 0.2 is the last frame in the previous GOP — needs a fresh GOP replay.
    expect(v).toBe('frame@0.20');
    expect(stepper.position).toBe(2);
  });

  it('returns null for out-of-range times', async () => {
    const { stepper } = setup();
    expect(await stepper.at(99)).toBeNull();
  });
});

describe('createCurrentTimeFallback', () => {
  it('drives video.currentTime and resolves on seeked', async () => {
    const index = createKeyframeIndex(samples);
    const listeners: Record<string, Array<(event: Event) => void>> = {};
    const video = {
      currentTime: 0,
      addEventListener: (type: string, handler: (event: Event) => void) => {
        let set = listeners[type];
        if (!set) {
          set = [];
          listeners[type] = set;
        }
        set.push(handler);
      },
      removeEventListener: (type: string, handler: (event: Event) => void) => {
        listeners[type] = (listeners[type] ?? []).filter((h) => h !== handler);
      },
    };

    const stepper = createCurrentTimeFallback({ index, video });

    const pending = stepper.at(0.45);
    expect(video.currentTime).toBeCloseTo(0.4, 5);
    // Simulate the seeked event the browser fires after the seek lands.
    for (const h of listeners.seeked ?? []) h(new Event('seeked'));
    await pending;
    expect(stepper.position).toBe(4);
  });

  it('returns null for out-of-range times without touching the video', async () => {
    const index = createKeyframeIndex(samples);
    const video = {
      currentTime: 1,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const stepper = createCurrentTimeFallback({ index, video });
    expect(await stepper.at(99)).toBeNull();
    expect(video.addEventListener).not.toHaveBeenCalled();
  });
});
