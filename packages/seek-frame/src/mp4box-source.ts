import { type Frame, type KeyframeIndex, createKeyframeIndex } from './keyframe-index.js';

/**
 * Minimal structural type for an MP4Box file instance. The full library
 * surface is sprawling; we only depend on the parts we actually drive.
 *
 * Consumers import `MP4Box.createFile` from `mp4box` themselves and pass
 * the namespace in — the binding stays optional and bundle-cost-free when
 * the consumer is not using MP4 demuxing.
 */
export interface Mp4BoxFileLike {
  onReady: ((info: Mp4BoxInfo) => void) | null;
  onError: ((message: string) => void) | null;
  onSamples:
    | ((trackId: number, user: unknown, samples: ReadonlyArray<Mp4BoxSample>) => void)
    | null;
  setExtractionOptions(trackId: number, user: unknown, opts: { nbSamples: number }): void;
  appendBuffer(buffer: ArrayBufferLike & { fileStart?: number }): number;
  start(): void;
  flush(): void;
  stop?(): void;
}

export interface Mp4BoxNamespace {
  createFile(): Mp4BoxFileLike;
}

export interface Mp4BoxTrack {
  id: number;
  type: 'video' | 'audio' | string;
  codec: string;
  timescale: number;
  duration: number;
  movie_duration: number;
  movie_timescale: number;
  nb_samples: number;
  video?: { width: number; height: number };
}

export interface Mp4BoxInfo {
  tracks: ReadonlyArray<Mp4BoxTrack>;
  duration: number;
  timescale: number;
}

export interface Mp4BoxSample {
  number: number;
  track_id: number;
  is_sync: boolean;
  dts: number;
  cts: number;
  duration: number;
  /** Per-sample timescale in ticks/second. */
  timescale: number;
  offset: number;
  size: number;
  data: Uint8Array;
}

/**
 * Convert one MP4Box sample (timestamps in track ticks) into a Bach `Frame`
 * (timestamps in seconds). Exported so callers writing custom demuxers can
 * reuse the unit conversion.
 */
export function sampleToFrame(sample: Mp4BoxSample): Frame {
  const dtsSec = sample.dts / sample.timescale;
  const ctsSec = sample.cts / sample.timescale;
  return {
    dts: dtsSec,
    pts: ctsSec,
    duration: sample.duration / sample.timescale,
    sync: sample.is_sync,
    offset: sample.offset,
    size: sample.size,
  };
}

export interface Mp4BoxSourceResult {
  index: KeyframeIndex;
  /** The picked video track. */
  track: Mp4BoxTrack;
  /** Per-frame byte slice; indexed by `Frame` position in `index.frames`. */
  data: ReadonlyArray<Uint8Array>;
  /** WebCodecs configuration to feed `VideoDecoder.configure()`. */
  codec: string;
  videoWidth: number;
  videoHeight: number;
}

export interface CreateMp4BoxSourceOptions {
  MP4Box: Mp4BoxNamespace;
  /** Raw MP4 / fMP4 bytes. Multiple chunks are accepted. */
  data: ReadonlyArray<ArrayBuffer> | ArrayBuffer;
  /** Track id to use. Defaults to the first video track. */
  trackId?: number;
}

/**
 * Parse a buffered MP4 / fMP4 into a Bach `KeyframeIndex` plus a per-frame
 * byte slice. Suitable for VOD; live-style append support arrives once the
 * scrub-engine + thumbnail strip needs it.
 *
 * Streaming model: callers pass either a single ArrayBuffer or a list of
 * chunks. The chunks are appended in order with monotonically increasing
 * `fileStart` offsets so MP4Box can deduce its index incrementally.
 */
export function createMp4BoxSource(opts: CreateMp4BoxSourceOptions): Promise<Mp4BoxSourceResult> {
  const chunks = Array.isArray(opts.data) ? opts.data : [opts.data];

  return new Promise<Mp4BoxSourceResult>((resolve, reject) => {
    const file = opts.MP4Box.createFile();
    const collected: Mp4BoxSample[] = [];

    let track: Mp4BoxTrack | null = null;
    let expected = 0;

    file.onError = (message): void => reject(new Error(`mp4box: ${message}`));

    file.onReady = (info): void => {
      const candidates = info.tracks.filter((t) => t.type === 'video');
      if (candidates.length === 0) {
        reject(new Error('mp4box: no video track'));
        return;
      }
      const picked =
        (opts.trackId !== undefined
          ? candidates.find((t) => t.id === opts.trackId)
          : candidates[0]) ?? null;
      if (!picked) {
        reject(new Error('mp4box: requested track id not found'));
        return;
      }
      track = picked;
      expected = picked.nb_samples;
      // Pull every sample. nbSamples=1 keeps the queue tight.
      file.setExtractionOptions(picked.id, null, { nbSamples: 1 });
      file.start();
    };

    file.onSamples = (_id, _user, samples): void => {
      for (const sample of samples) collected.push(sample);
      if (track && collected.length >= expected) {
        const frames = collected.map(sampleToFrame);
        const index = createKeyframeIndex(frames);
        const data = collected
          .slice()
          .sort((a, b) => a.cts - b.cts)
          .map((s) => s.data);
        resolve({
          index,
          track,
          data,
          codec: track.codec,
          videoWidth: track.video?.width ?? 0,
          videoHeight: track.video?.height ?? 0,
        });
        file.stop?.();
      }
    };

    let offset = 0;
    for (const chunk of chunks) {
      const tagged = chunk as ArrayBuffer & { fileStart?: number };
      tagged.fileStart = offset;
      file.appendBuffer(tagged);
      offset += chunk.byteLength;
    }
    file.flush();
  });
}
