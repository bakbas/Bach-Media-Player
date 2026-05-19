/**
 * Minimal structural type for the WebCodecs `VideoDecoder` class. We avoid
 * importing the global type so the package compiles without the WebCodecs
 * lib being in scope (Safari/iOS still lacks it as of writing), and so the
 * tests can pass a fake decoder.
 */
export interface VideoDecoderLike {
  configure(config: VideoDecoderConfigLike): void;
  decode(chunk: EncodedVideoChunkLike): void;
  flush(): Promise<void>;
  reset(): void;
  close(): void;
  readonly state: 'unconfigured' | 'configured' | 'closed';
  readonly decodeQueueSize: number;
}

export interface VideoDecoderConfigLike {
  codec: string;
  codedWidth?: number;
  codedHeight?: number;
  description?: BufferSource;
  optimizeForLatency?: boolean;
}

export interface EncodedVideoChunkLike {
  readonly type: 'key' | 'delta';
  readonly timestamp: number;
  readonly duration: number | null;
  readonly byteLength: number;
}

export interface DecodedFrame {
  /** Presentation timestamp in seconds. */
  pts: number;
  /** The decoded frame payload — typically a `VideoFrame` from WebCodecs. */
  value: unknown;
  /** Estimated GPU/system memory cost. */
  bytes: number;
  /** Caller-provided cleanup. */
  release?: () => void;
}

export interface VideoDecoderFactoryOptions {
  output: (frame: DecodedFrame) => void;
  error: (error: { message: string }) => void;
}

/** Factory function so tests can inject a fake decoder constructor. */
export type VideoDecoderFactory = (opts: VideoDecoderFactoryOptions) => VideoDecoderLike;

/**
 * Read-only handle returned by `createDecoderController`. It bundles the
 * configured decoder, an in-flight queue size hint, and a `decode()` API
 * that resolves once `output()` has fired for a target presentation time.
 *
 * The controller does not own the sample fetching — callers feed encoded
 * chunks one at a time. This separation keeps the bytestream source
 * pluggable (MP4Box for VOD, hls.js for live, the user's own demuxer).
 */
export interface DecoderController {
  configure(config: VideoDecoderConfigLike): void;
  /**
   * Submit one encoded chunk. The decoder controller awaits the matching
   * `output()` callback (by pts) and resolves the returned promise with the
   * decoded frame. Several outstanding decodes are supported — the first
   * frame whose pts matches resolves its waiting promise.
   */
  decode(chunk: EncodedVideoChunkLike, pts: number): Promise<DecodedFrame>;
  /** Drain in-flight decodes and return when the queue is empty. */
  flush(): Promise<void>;
  /** Reset the decoder (drop pending decodes); call before a seek. */
  reset(): void;
  close(): void;
  readonly state: VideoDecoderLike['state'];
  readonly queueSize: number;
}

interface PendingDecode {
  pts: number;
  resolve: (frame: DecodedFrame) => void;
  reject: (err: Error) => void;
}

export function createDecoderController(factory: VideoDecoderFactory): DecoderController {
  const pending: PendingDecode[] = [];
  const queue: DecodedFrame[] = [];

  const decoder = factory({
    output(frame) {
      // Try to deliver to the next caller waiting for this pts.
      const idx = pending.findIndex((p) => Math.abs(p.pts - frame.pts) < 1e-6);
      if (idx >= 0) {
        const [waiter] = pending.splice(idx, 1);
        waiter?.resolve(frame);
        return;
      }
      // Buffer for a caller that hasn't asked yet (unlikely under normal
      // flow but harmless — keeps the API resilient to reordering).
      queue.push(frame);
    },
    error(err) {
      while (pending.length) pending.shift()?.reject(new Error(err.message));
    },
  });

  return {
    configure(config) {
      decoder.configure(config);
    },

    decode(chunk, pts) {
      return new Promise<DecodedFrame>((resolve, reject) => {
        // Maybe a previous output() already buffered a frame for this pts.
        const cachedIdx = queue.findIndex((f) => Math.abs(f.pts - pts) < 1e-6);
        if (cachedIdx >= 0) {
          const [frame] = queue.splice(cachedIdx, 1);
          if (frame) {
            resolve(frame);
            return;
          }
        }
        pending.push({ pts, resolve, reject });
        try {
          decoder.decode(chunk);
        } catch (err) {
          // Pull the pending entry back out and reject explicitly.
          const idx = pending.findIndex((p) => p.resolve === resolve && p.reject === reject);
          if (idx >= 0) pending.splice(idx, 1);
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    },

    async flush() {
      await decoder.flush();
    },

    reset() {
      decoder.reset();
      while (pending.length) pending.shift()?.reject(new Error('decoder reset'));
      // Buffered frames are stale after reset — let the caller's release()
      // run so we don't leak GPU memory.
      while (queue.length) {
        const frame = queue.shift();
        frame?.release?.();
      }
    },

    close() {
      this.reset();
      decoder.close();
    },

    get state() {
      return decoder.state;
    },
    get queueSize() {
      return decoder.decodeQueueSize;
    },
  };
}

/**
 * Tells you whether the runtime exposes WebCodecs at all. Use this in
 * `<bach-player>` to decide whether to mount the frame-accurate path or
 * fall back to setting `currentTime` directly.
 */
export function isWebCodecsSupported(): boolean {
  return typeof globalThis !== 'undefined' && 'VideoDecoder' in globalThis;
}
