import { describe, expect, it, vi } from 'vitest';
import { WHISPER_SAMPLE_RATE, WINDOW_SAMPLES } from './audio-chunker.js';
import { createTranscriptionController } from './controller.js';
import type { Segment } from './timing-aligner.js';
import type { TranscriptionEngine } from './whisper.js';

const fillBlock = (n: number, value = 0): Float32Array => {
  const a = new Float32Array(n);
  a.fill(value);
  return a;
};

function fakeEngine(scriptedSegments: ReadonlyArray<Segment[]>): TranscriptionEngine {
  let call = 0;
  return {
    name: 'fake',
    transcribe: vi.fn(async () => {
      const segments = scriptedSegments[call] ?? [];
      call += 1;
      return [...segments];
    }),
  };
}

describe('createTranscriptionController', () => {
  it('forwards engine segments offset by the chunk start time', async () => {
    const engine = fakeEngine([[{ start: 1, end: 2, text: 'hi' }]]);
    const onSegments = vi.fn();
    const controller = createTranscriptionController({
      engine,
      chunker: { sourceSampleRate: WHISPER_SAMPLE_RATE },
      onSegments,
    });
    controller.push(fillBlock(WINDOW_SAMPLES, 0.1));
    await controller.stop();
    expect(onSegments).toHaveBeenCalledTimes(1);
    expect(onSegments.mock.calls[0]?.[0]).toEqual([{ start: 1, end: 2, text: 'hi' }]);
  });

  it('offsets subsequent windows by their stride', async () => {
    const engine = fakeEngine([
      [{ start: 0, end: 1, text: 'a' }],
      [{ start: 0, end: 1, text: 'b' }],
    ]);
    const onSegments = vi.fn();
    const controller = createTranscriptionController({
      engine,
      chunker: { sourceSampleRate: WHISPER_SAMPLE_RATE },
      onSegments,
    });
    // Two windows worth (window + stride = 30s + 25s).
    controller.push(fillBlock(WINDOW_SAMPLES + WHISPER_SAMPLE_RATE * 25, 0));
    await controller.stop();
    expect(onSegments).toHaveBeenCalledTimes(2);
    expect(onSegments.mock.calls[0]?.[0][0].start).toBe(0);
    expect(onSegments.mock.calls[1]?.[0][0].start).toBeCloseTo(25, 5);
  });

  it('keeps at most one inference in-flight (serialised)', async () => {
    let observed = 0;
    let maxObserved = 0;
    const engine: TranscriptionEngine = {
      name: 'slow',
      transcribe: vi.fn(async () => {
        observed += 1;
        maxObserved = Math.max(maxObserved, observed);
        await new Promise<void>((resolve) => setTimeout(resolve, 5));
        observed -= 1;
        return [];
      }),
    };
    const controller = createTranscriptionController({
      engine,
      chunker: { sourceSampleRate: WHISPER_SAMPLE_RATE },
      onSegments: () => {},
    });
    controller.push(fillBlock(WINDOW_SAMPLES + WHISPER_SAMPLE_RATE * 25, 0));
    await controller.stop();
    expect(maxObserved).toBeLessThanOrEqual(1);
  });

  it('surfaces engine errors via onError without halting the walker', async () => {
    let call = 0;
    const engine: TranscriptionEngine = {
      name: 'flaky',
      transcribe: vi.fn(async () => {
        call += 1;
        if (call === 1) throw new Error('boom');
        return [{ start: 0, end: 1, text: 'recovered' }];
      }),
    };
    const onSegments = vi.fn();
    const onError = vi.fn();
    const controller = createTranscriptionController({
      engine,
      chunker: { sourceSampleRate: WHISPER_SAMPLE_RATE },
      onSegments,
      onError,
    });
    controller.push(fillBlock(WINDOW_SAMPLES + WHISPER_SAMPLE_RATE * 25, 0));
    await controller.stop();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onSegments).toHaveBeenCalledTimes(1);
    expect(onSegments.mock.calls[0]?.[0][0].text).toBe('recovered');
  });

  it('drops further audio after stop()', async () => {
    const engine = fakeEngine([[]]);
    const controller = createTranscriptionController({
      engine,
      chunker: { sourceSampleRate: WHISPER_SAMPLE_RATE },
      onSegments: () => {},
    });
    await controller.stop();
    controller.push(fillBlock(WINDOW_SAMPLES, 0));
    expect(engine.transcribe).not.toHaveBeenCalled();
  });
});
