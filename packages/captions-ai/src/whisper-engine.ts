import type { Segment } from './timing-aligner.js';
import {
  type ModelCacheProbe,
  type TranscribeOptions,
  type TranscriptionEngine,
  WHISPER_MODELS,
  type WhisperModelKey,
} from './whisper.js';

/**
 * Minimal structural type for the Transformers.js `pipeline()` function. We
 * avoid importing the package directly so the bundle stays free of its
 * weights and types unless the consumer opts in by passing `pipeline` here.
 *
 * The v3 API returns an `AutomaticSpeechRecognitionPipeline` whose call
 * signature accepts a Float32Array (or an URL string) and resolves with
 * `{ text, chunks: [{ timestamp: [start, end], text }] }` when
 * `return_timestamps: true` is requested.
 */
export type TransformersPipelineFactory = (
  task: 'automatic-speech-recognition',
  model: string,
  options?: PipelineOptions,
) => Promise<TransformersASRPipeline>;

export interface PipelineOptions {
  progress_callback?: (event: ProgressEvent) => void;
  dtype?: string;
  device?: 'webgpu' | 'wasm' | 'cpu';
}

export interface ProgressEvent {
  status: 'initiate' | 'download' | 'progress' | 'done' | 'ready';
  name?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

export interface TransformersASRPipeline {
  (
    audio: Float32Array,
    options?: { language?: string; task?: string; return_timestamps?: boolean },
  ): Promise<TransformersASRResult>;
  dispose?(): Promise<void>;
}

export interface TransformersASRResult {
  text?: string;
  chunks?: Array<{
    timestamp: [number, number | null];
    text: string;
  }>;
}

export interface CreateWhisperEngineOptions {
  /** Pass the `pipeline` function exported by `@huggingface/transformers`. */
  pipeline: TransformersPipelineFactory;
  /** Which Whisper variant. Defaults to `tiny` (39 MB). */
  model?: WhisperModelKey;
  /** Override the model id entirely — e.g. for a self-hosted mirror. */
  modelId?: string;
  /** Device preference. Defaults to `webgpu` then falls back to `wasm`. */
  device?: PipelineOptions['device'];
  /** Forwarded to Transformers.js, e.g. `'fp16'` on supported hardware. */
  dtype?: string;
  /** Called with download / load progress events. */
  onProgress?: (event: ProgressEvent) => void;
}

/**
 * Build a TranscriptionEngine backed by Transformers.js' Whisper pipeline.
 * Returns a Promise because pipeline construction is async (it fetches the
 * model weights). Once resolved, `transcribe()` is callable per chunk.
 */
export async function createWhisperEngine(
  opts: CreateWhisperEngineOptions,
): Promise<TranscriptionEngine> {
  const modelKey = opts.model ?? 'tiny';
  const modelId = opts.modelId ?? WHISPER_MODELS[modelKey].id;
  const device = opts.device ?? 'webgpu';

  let pipeline: TransformersASRPipeline;
  try {
    pipeline = await opts.pipeline('automatic-speech-recognition', modelId, {
      device,
      ...(opts.dtype ? { dtype: opts.dtype } : {}),
      ...(opts.onProgress ? { progress_callback: opts.onProgress } : {}),
    });
  } catch (err) {
    // WebGPU might be reported as supported but fail at adapter request.
    // Retry once on `wasm` so users on older Chromiums still get captions.
    if (device === 'webgpu') {
      pipeline = await opts.pipeline('automatic-speech-recognition', modelId, {
        device: 'wasm',
        ...(opts.onProgress ? { progress_callback: opts.onProgress } : {}),
      });
    } else {
      throw err;
    }
  }

  return {
    name: `whisper:${modelKey}`,

    async transcribe(pcm, options: TranscribeOptions = {}): Promise<Segment[]> {
      const explicit = options.language && options.language !== 'auto' ? options.language : null;
      const result = await pipeline(pcm, {
        ...(explicit ? { language: explicit } : {}),
        return_timestamps: true,
      });
      const chunks = result.chunks ?? [];
      const segments: Segment[] = [];
      for (const chunk of chunks) {
        const [start, end] = chunk.timestamp;
        if (start == null || end == null) continue;
        if (!chunk.text || chunk.text.trim().length === 0) continue;
        segments.push({ start, end, text: chunk.text });
      }
      return segments;
    },

    async dispose() {
      await pipeline.dispose?.();
    },
  };
}

/**
 * Convenience: write the model id into the user's Cache API entry so the
 * next session can short-circuit the permission prompt. The Transformers.js
 * runtime already populates the underlying cache during weight fetch; this
 * function is the inverse of `createCacheApiProbe` for explicit testing.
 */
export interface MarkCachedOptions {
  cacheName?: string;
}

export async function markModelCached(
  modelId: string,
  opts: MarkCachedOptions = {},
): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(opts.cacheName ?? 'bach-captions-models');
    await cache.put(
      new Request(`https://bach-internal/${encodeURIComponent(modelId)}`),
      new Response('1'),
    );
  } catch {
    // Quota exceeded or partial Cache API — fail silently.
  }
}

export type { ModelCacheProbe };
