import { describe, expect, it, vi } from 'vitest';
import {
  type TransformersASRPipeline,
  type TransformersASRResult,
  type TransformersPipelineFactory,
  createWhisperEngine,
} from './whisper-engine.js';

function makePipeline(result: TransformersASRResult): TransformersASRPipeline {
  const pipeline = (async () => result) as unknown as TransformersASRPipeline;
  pipeline.dispose = vi.fn(async () => {});
  return pipeline;
}

function makeFactory(
  pipeline: TransformersASRPipeline,
  opts: { failFirst?: boolean } = {},
): TransformersPipelineFactory {
  let called = 0;
  const factory: TransformersPipelineFactory = async () => {
    called += 1;
    if (opts.failFirst && called === 1) throw new Error('webgpu unavailable');
    return pipeline;
  };
  return factory;
}

describe('createWhisperEngine', () => {
  it('returns an engine whose name reflects the model key', async () => {
    const engine = await createWhisperEngine({
      pipeline: makeFactory(makePipeline({ chunks: [] })),
      model: 'base',
    });
    expect(engine.name).toBe('whisper:base');
  });

  it('maps Transformers.js chunks to Bach segments', async () => {
    const pipeline = makePipeline({
      chunks: [
        { timestamp: [0, 2], text: 'hello' },
        { timestamp: [2, 4.5], text: 'world' },
      ],
    });
    const engine = await createWhisperEngine({ pipeline: makeFactory(pipeline) });
    const out = await engine.transcribe(new Float32Array(16_000));
    expect(out).toEqual([
      { start: 0, end: 2, text: 'hello' },
      { start: 2, end: 4.5, text: 'world' },
    ]);
  });

  it('drops chunks with null end timestamps or empty text', async () => {
    const pipeline = makePipeline({
      chunks: [
        { timestamp: [0, null], text: 'no end' },
        { timestamp: [1, 2], text: '   ' },
        { timestamp: [2, 3], text: 'kept' },
      ],
    });
    const engine = await createWhisperEngine({ pipeline: makeFactory(pipeline) });
    const out = await engine.transcribe(new Float32Array(16_000));
    expect(out).toEqual([{ start: 2, end: 3, text: 'kept' }]);
  });

  it('passes language through when explicit, omits when auto', async () => {
    const pipelineCall = vi.fn(async () => ({ chunks: [] }) as TransformersASRResult);
    const pipeline = pipelineCall as unknown as TransformersASRPipeline;
    pipeline.dispose = async () => {};

    const engine = await createWhisperEngine({ pipeline: makeFactory(pipeline) });

    await engine.transcribe(new Float32Array(16_000), { language: 'tr' });
    expect(pipelineCall).toHaveBeenLastCalledWith(expect.any(Float32Array), {
      language: 'tr',
      return_timestamps: true,
    });

    await engine.transcribe(new Float32Array(16_000), { language: 'auto' });
    expect(pipelineCall).toHaveBeenLastCalledWith(expect.any(Float32Array), {
      return_timestamps: true,
    });
  });

  it('forwards onProgress to the factory', async () => {
    const factoryCall = vi.fn(async () => makePipeline({ chunks: [] }));
    const onProgress = vi.fn();
    await createWhisperEngine({
      pipeline: factoryCall as unknown as TransformersPipelineFactory,
      onProgress,
    });
    expect(factoryCall).toHaveBeenCalledWith(
      'automatic-speech-recognition',
      expect.any(String),
      expect.objectContaining({ progress_callback: onProgress }),
    );
  });

  it('falls back from webgpu to wasm when the first attempt throws', async () => {
    const pipeline = makePipeline({ chunks: [] });
    const factory = vi.fn(makeFactory(pipeline, { failFirst: true }));
    const engine = await createWhisperEngine({
      pipeline: factory as unknown as TransformersPipelineFactory,
      device: 'webgpu',
    });
    expect(engine.name).toContain('whisper');
    expect(factory).toHaveBeenCalledTimes(2);
    expect(factory.mock.calls[1]?.[2]).toMatchObject({ device: 'wasm' });
  });

  it('dispose() forwards to the pipeline', async () => {
    const pipeline = makePipeline({ chunks: [] });
    const engine = await createWhisperEngine({ pipeline: makeFactory(pipeline) });
    await engine.dispose?.();
    expect(pipeline.dispose).toHaveBeenCalled();
  });
});
