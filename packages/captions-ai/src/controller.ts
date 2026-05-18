import { type AudioChunkerOptions, createAudioChunker } from './audio-chunker.js';
import type { Segment } from './timing-aligner.js';
import type { TranscribeOptions, TranscriptionEngine } from './whisper.js';

export interface TranscriptionControllerOptions {
  engine: TranscriptionEngine;
  chunker?: AudioChunkerOptions;
  /** Per-chunk transcription timeout and language. */
  transcribe?: TranscribeOptions;
  /** Called whenever a chunk finishes transcribing. */
  onSegments: (segments: Segment[]) => void;
  /** Called on engine failure for a single chunk. Recoverable; controller keeps running. */
  onError?: (err: unknown) => void;
}

export interface TranscriptionController {
  push(samples: Float32Array, channels?: number): void;
  /** Stop accepting new audio and wait for any already-queued chunks to finish. */
  stop(): Promise<void>;
  readonly inFlight: number;
}

/**
 * Glue between the audio chunker and the transcription engine. Responsible
 * for offsetting each window's relative timestamps by its `startSeconds`,
 * for keeping inferences serialised (one chunk at a time so the worker queue
 * does not blow up), and for surfacing engine errors to the caller.
 *
 * Lifecycle:
 *   - `push()` adds audio and starts a drain walker if one is not already
 *     running.
 *   - The drain walker pulls chunks until the chunker reports empty, then
 *     exits. A subsequent `push()` may restart it.
 *   - `stop()` blocks new `push()` calls and awaits the active drain so the
 *     chunks already in the buffer still get transcribed.
 */
export function createTranscriptionController(
  opts: TranscriptionControllerOptions,
): TranscriptionController {
  const chunker = createAudioChunker(opts.chunker ?? { sourceSampleRate: 48_000 });
  let stopped = false;
  let inFlight = 0;
  let drain: Promise<void> | null = null;

  const drainOnce = async (): Promise<void> => {
    while (true) {
      const chunk = chunker.pullChunk();
      if (!chunk) return;
      inFlight += 1;
      try {
        const raw = await opts.engine.transcribe(chunk.pcm, opts.transcribe);
        const offset = chunk.startSeconds;
        opts.onSegments(
          raw.map((s) => ({ start: s.start + offset, end: s.end + offset, text: s.text })),
        );
      } catch (err) {
        opts.onError?.(err);
      } finally {
        inFlight -= 1;
      }
    }
  };

  const schedule = (): void => {
    if (drain) return;
    drain = drainOnce().finally(() => {
      drain = null;
    });
  };

  return {
    push(samples, channels) {
      if (stopped) return;
      chunker.push(samples, channels);
      schedule();
    },
    async stop() {
      stopped = true;
      if (drain) await drain;
    },
    get inFlight() {
      return inFlight;
    },
  };
}
