import { describe, expect, it, vi } from 'vitest';
import {
  type DecodedFrame,
  type EncodedVideoChunkLike,
  type VideoDecoderFactoryOptions,
  type VideoDecoderLike,
  createDecoderController,
  isWebCodecsSupported,
} from './decoder.js';

class FakeDecoder implements VideoDecoderLike {
  state: VideoDecoderLike['state'] = 'unconfigured';
  decodeQueueSize = 0;
  configurations: unknown[] = [];
  decoded: EncodedVideoChunkLike[] = [];
  output: (frame: DecodedFrame) => void;
  errorHandler: (err: { message: string }) => void;

  constructor(opts: VideoDecoderFactoryOptions) {
    this.output = opts.output;
    this.errorHandler = opts.error;
  }
  configure(c: unknown): void {
    this.configurations.push(c);
    this.state = 'configured';
  }
  decode(chunk: EncodedVideoChunkLike): void {
    this.decoded.push(chunk);
  }
  emit(pts: number, value: unknown = { pts }, bytes = 4096): void {
    this.output({ pts, value, bytes });
  }
  fail(message: string): void {
    this.errorHandler({ message });
  }
  flush(): Promise<void> {
    return Promise.resolve();
  }
  reset(): void {
    this.decoded = [];
  }
  close(): void {
    this.state = 'closed';
  }
}

const chunk = (timestamp: number, type: 'key' | 'delta' = 'key'): EncodedVideoChunkLike => ({
  type,
  timestamp,
  duration: null,
  byteLength: 1,
});

describe('createDecoderController', () => {
  it('resolves a decode promise when the decoder outputs a matching pts', async () => {
    let fake!: FakeDecoder;
    const controller = createDecoderController((opts) => {
      fake = new FakeDecoder(opts);
      return fake;
    });
    controller.configure({ codec: 'avc1.42E01E' });
    const pending = controller.decode(chunk(0), 0);
    fake.emit(0, { tag: 'frame-0' });
    const frame = await pending;
    expect(frame.value).toEqual({ tag: 'frame-0' });
  });

  it('forwards multiple decodes and matches them by pts', async () => {
    let fake!: FakeDecoder;
    const controller = createDecoderController((opts) => {
      fake = new FakeDecoder(opts);
      return fake;
    });
    controller.configure({ codec: 'avc1.42E01E' });
    const a = controller.decode(chunk(0), 0);
    const b = controller.decode(chunk(0.033), 0.033);
    fake.emit(0.033, 'b');
    fake.emit(0, 'a');
    expect((await a).value).toBe('a');
    expect((await b).value).toBe('b');
  });

  it('buffers an early output and delivers it to a later decode', async () => {
    let fake!: FakeDecoder;
    const controller = createDecoderController((opts) => {
      fake = new FakeDecoder(opts);
      return fake;
    });
    controller.configure({ codec: 'avc1.42E01E' });
    fake.emit(1, 'cached');
    const promise = controller.decode(chunk(1), 1);
    await expect(promise).resolves.toMatchObject({ value: 'cached' });
  });

  it('rejects pending decodes on error()', async () => {
    let fake!: FakeDecoder;
    const controller = createDecoderController((opts) => {
      fake = new FakeDecoder(opts);
      return fake;
    });
    controller.configure({ codec: 'avc1.42E01E' });
    const a = controller.decode(chunk(0), 0);
    fake.fail('hardware error');
    await expect(a).rejects.toThrow('hardware error');
  });

  it('reset() rejects pending decodes and releases buffered frames', async () => {
    let fake!: FakeDecoder;
    const controller = createDecoderController((opts) => {
      fake = new FakeDecoder(opts);
      return fake;
    });
    controller.configure({ codec: 'avc1.42E01E' });
    const release = vi.fn();
    fake.output({ pts: 5, value: 'cached', bytes: 100, release });
    const pending = controller.decode(chunk(2), 2);
    controller.reset();
    expect(release).toHaveBeenCalledTimes(1);
    await expect(pending).rejects.toThrow('decoder reset');
  });

  it('decode() rejects if the underlying decoder throws synchronously', async () => {
    const controller = createDecoderController((opts) => {
      const d = new FakeDecoder(opts);
      d.decode = () => {
        throw new Error('bad chunk');
      };
      return d;
    });
    controller.configure({ codec: 'avc1.42E01E' });
    await expect(controller.decode(chunk(0), 0)).rejects.toThrow('bad chunk');
  });
});

describe('isWebCodecsSupported', () => {
  it('returns false in happy-dom (no VideoDecoder)', () => {
    expect(isWebCodecsSupported()).toBe(false);
  });
});
