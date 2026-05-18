import { describe, expect, it } from 'vitest';
import {
  WHISPER_SAMPLE_RATE,
  WINDOW_SAMPLES,
  createAudioChunker,
  downmixToMono,
  resampleLinear,
} from './audio-chunker.js';

describe('resampleLinear', () => {
  it('returns the input unchanged when rates match', () => {
    const a = new Float32Array([1, 2, 3, 4]);
    expect(resampleLinear(a, 16000, 16000)).toBe(a);
  });

  it('halves length when downsampling 2:1', () => {
    const a = new Float32Array([0, 1, 0, 1, 0, 1, 0, 1]);
    const out = resampleLinear(a, 32000, 16000);
    expect(out.length).toBe(4);
  });

  it('preserves DC level when upsampling', () => {
    const a = new Float32Array([0.5, 0.5, 0.5, 0.5]);
    const out = resampleLinear(a, 8000, 16000);
    expect(out.length).toBeGreaterThan(a.length);
    for (let i = 0; i < out.length; i += 1) {
      expect(out[i]).toBeCloseTo(0.5, 5);
    }
  });
});

describe('downmixToMono', () => {
  it('returns the input unchanged for mono', () => {
    const a = new Float32Array([0.1, 0.2, 0.3]);
    expect(downmixToMono(a, 1)).toBe(a);
  });

  it('averages stereo channels', () => {
    const a = new Float32Array([0.0, 1.0, 0.5, 0.5, -0.2, 0.4]);
    const out = downmixToMono(a, 2);
    expect(Array.from(out)).toEqual([0.5, 0.5, 0.10000000149011612]);
  });
});

describe('createAudioChunker', () => {
  const fillBlock = (n: number, value: number): Float32Array => {
    const a = new Float32Array(n);
    a.fill(value);
    return a;
  };

  it('returns null until a full window has accumulated', () => {
    const chunker = createAudioChunker({ sourceSampleRate: WHISPER_SAMPLE_RATE });
    chunker.push(fillBlock(WHISPER_SAMPLE_RATE, 0.1));
    expect(chunker.pullChunk()).toBeNull();
  });

  it('emits a 30 s window once enough samples are present', () => {
    const chunker = createAudioChunker({ sourceSampleRate: WHISPER_SAMPLE_RATE });
    chunker.push(fillBlock(WINDOW_SAMPLES, 0.25));
    const chunk = chunker.pullChunk();
    expect(chunk).not.toBeNull();
    expect(chunk?.pcm.length).toBe(WINDOW_SAMPLES);
    expect(chunk?.startSeconds).toBe(0);
    expect(chunk?.endSeconds).toBeCloseTo(30, 5);
    expect(chunk?.pcm[0]).toBeCloseTo(0.25, 5);
  });

  it('overlaps subsequent windows by the overlap period', () => {
    const chunker = createAudioChunker({ sourceSampleRate: WHISPER_SAMPLE_RATE });
    // Two full strides + window: enough for two emitted windows.
    chunker.push(fillBlock(WINDOW_SAMPLES + WHISPER_SAMPLE_RATE * 25, 0));
    const first = chunker.pullChunk();
    const second = chunker.pullChunk();
    expect(first?.startSeconds).toBe(0);
    // stride is 25 s, so second window starts at 25 s.
    expect(second?.startSeconds).toBeCloseTo(25, 5);
  });

  it('resamples from the source rate before chunking', () => {
    const chunker = createAudioChunker({ sourceSampleRate: 48_000 });
    // 48000 Hz × 30 s = 1.44M samples → resamples to 480000, then 30s @ 16k = 480000.
    chunker.push(fillBlock(48_000 * 30, 0.5));
    const chunk = chunker.pullChunk();
    expect(chunk?.pcm.length).toBe(WINDOW_SAMPLES);
  });

  it('honours startOffsetSeconds when reporting timestamps', () => {
    const chunker = createAudioChunker({
      sourceSampleRate: WHISPER_SAMPLE_RATE,
      startOffsetSeconds: 100,
    });
    chunker.push(fillBlock(WINDOW_SAMPLES, 0));
    expect(chunker.pullChunk()?.startSeconds).toBe(100);
  });

  it('downmixes interleaved stereo input before chunking', () => {
    const chunker = createAudioChunker({ sourceSampleRate: WHISPER_SAMPLE_RATE });
    const stereo = new Float32Array(WINDOW_SAMPLES * 2);
    for (let i = 0; i < stereo.length; i += 2) {
      stereo[i] = 1;
      stereo[i + 1] = -1;
    }
    chunker.push(stereo, 2);
    const chunk = chunker.pullChunk();
    expect(chunk?.pcm.length).toBe(WINDOW_SAMPLES);
    expect(chunk?.pcm[0]).toBeCloseTo(0, 5);
  });

  it('throws when stride > window', () => {
    expect(() =>
      createAudioChunker({
        sourceSampleRate: WHISPER_SAMPLE_RATE,
        windowSamples: 1000,
        strideSamples: 2000,
      }),
    ).toThrow(/stride/);
  });
});
