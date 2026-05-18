/**
 * Sliding-window audio chunker for Whisper inference.
 *
 * Whisper expects 16 kHz mono Float32 PCM with an optimum window of 30 s and
 * a small overlap so phonemes that fall on a window boundary still surface
 * at least once. The chunker is a pure ring buffer: callers `push()` frames
 * from an AudioWorklet, and `pullChunk()` returns the next 30 s window when
 * enough audio has accumulated.
 *
 * Intentionally has no DOM / Web Audio dependency so it can be unit-tested
 * in happy-dom and reused inside an AudioWorklet without a polyfill.
 */
export const WHISPER_SAMPLE_RATE = 16_000;
export const WINDOW_SECONDS = 30;
export const OVERLAP_SECONDS = 5;

export const WINDOW_SAMPLES = WHISPER_SAMPLE_RATE * WINDOW_SECONDS;
export const STRIDE_SAMPLES = WHISPER_SAMPLE_RATE * (WINDOW_SECONDS - OVERLAP_SECONDS);

export interface AudioChunk {
  /** Sample timestamp where this window starts (seconds, host clock). */
  startSeconds: number;
  endSeconds: number;
  pcm: Float32Array;
}

export interface AudioChunkerOptions {
  /** Source sample rate in Hz. Frames at any rate are resampled to 16 kHz. */
  sourceSampleRate: number;
  /** Starting wall-clock offset, in seconds. */
  startOffsetSeconds?: number;
  /** Override the window length (sample count). Defaults to 30 s. */
  windowSamples?: number;
  /** Override the stride (sample count). Defaults to 25 s (30-5 overlap). */
  strideSamples?: number;
}

interface AudioChunker {
  /** Push a block of PCM samples (any number, mono or interleaved stereo). */
  push(samples: Float32Array, channels?: number): void;
  /** Pull the next ready 30 s window, or `null` if not enough audio yet. */
  pullChunk(): AudioChunk | null;
  /** Total samples ingested at the source rate. */
  readonly samplesIngested: number;
}

/**
 * Resample one block from `from` Hz to `to` Hz using linear interpolation.
 * Linear is good enough for speech recognition pre-processing; we are not
 * trying to preserve formant fidelity for music transcription.
 */
export function resampleLinear(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input;
  const ratio = from / to;
  const outLength = Math.floor(input.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i += 1) {
    const srcIndex = i * ratio;
    const lo = Math.floor(srcIndex);
    const hi = Math.min(lo + 1, input.length - 1);
    const t = srcIndex - lo;
    out[i] = (input[lo] ?? 0) * (1 - t) + (input[hi] ?? 0) * t;
  }
  return out;
}

/**
 * Average an interleaved multi-channel block down to mono. Whisper takes
 * mono; we average rather than picking channel 0 because the side channel
 * in stereo often carries dialogue stems in well-mixed sources.
 */
export function downmixToMono(samples: Float32Array, channels: number): Float32Array {
  if (channels <= 1) return samples;
  const frameCount = Math.floor(samples.length / channels);
  const out = new Float32Array(frameCount);
  for (let f = 0; f < frameCount; f += 1) {
    let sum = 0;
    for (let c = 0; c < channels; c += 1) sum += samples[f * channels + c] ?? 0;
    out[f] = sum / channels;
  }
  return out;
}

export function createAudioChunker(opts: AudioChunkerOptions): AudioChunker {
  const windowSamples = opts.windowSamples ?? WINDOW_SAMPLES;
  const strideSamples = opts.strideSamples ?? STRIDE_SAMPLES;
  if (strideSamples > windowSamples) {
    throw new Error('strideSamples must be <= windowSamples');
  }

  // Single growing Float32Array sliced lazily. Resetting `bufferStart` each
  // time we emit a chunk keeps memory bounded by ~2x the window size.
  let buffer = new Float32Array(windowSamples * 2);
  let length = 0;
  let cursor = 0;
  let samplesIngested = 0;
  const startOffset = opts.startOffsetSeconds ?? 0;

  const ensureCapacity = (needed: number): void => {
    if (length + needed <= buffer.length) return;
    let next = buffer.length;
    while (length + needed > next) next *= 2;
    const grown = new Float32Array(next);
    grown.set(buffer.subarray(0, length));
    buffer = grown;
  };

  const advance = (samples: number): void => {
    cursor += samples;
    // Compact when the unused prefix exceeds the window — keeps the buffer
    // tight without copying on every chunk.
    if (cursor >= windowSamples) {
      buffer.copyWithin(0, cursor, length);
      length -= cursor;
      cursor = 0;
    }
  };

  return {
    get samplesIngested() {
      return samplesIngested;
    },

    push(samples: Float32Array, channels = 1): void {
      const mono = downmixToMono(samples, channels);
      const resampled = resampleLinear(mono, opts.sourceSampleRate, WHISPER_SAMPLE_RATE);
      ensureCapacity(resampled.length);
      buffer.set(resampled, length);
      length += resampled.length;
      samplesIngested += mono.length;
    },

    pullChunk(): AudioChunk | null {
      const available = length - cursor;
      if (available < windowSamples) return null;
      const pcm = buffer.slice(cursor, cursor + windowSamples);
      const startSeconds = startOffset + cursor / WHISPER_SAMPLE_RATE;
      const endSeconds = startSeconds + windowSamples / WHISPER_SAMPLE_RATE;
      advance(strideSamples);
      return { startSeconds, endSeconds, pcm };
    },
  };
}
