import { describe, expect, it } from 'vitest';
import {
  type Mp4BoxFileLike,
  type Mp4BoxNamespace,
  type Mp4BoxSample,
  createMp4BoxSource,
  sampleToFrame,
} from './mp4box-source.js';

function sample(over: Partial<Mp4BoxSample>): Mp4BoxSample {
  return {
    number: 0,
    track_id: 1,
    is_sync: false,
    dts: 0,
    cts: 0,
    duration: 3000,
    timescale: 90_000,
    offset: 0,
    size: 1000,
    data: new Uint8Array([1]),
    ...over,
  };
}

describe('sampleToFrame', () => {
  it('converts track ticks to seconds', () => {
    const f = sampleToFrame(sample({ dts: 90_000, cts: 93_000, duration: 3000, is_sync: true }));
    expect(f.dts).toBeCloseTo(1, 6);
    expect(f.pts).toBeCloseTo(93_000 / 90_000, 6);
    expect(f.duration).toBeCloseTo(3000 / 90_000, 6);
    expect(f.sync).toBe(true);
  });
});

interface FakeFileState {
  buffers: ArrayBuffer[];
  ready: ((info: Parameters<NonNullable<Mp4BoxFileLike['onReady']>>[0]) => void) | null;
  samples: ((id: number, user: unknown, samples: ReadonlyArray<Mp4BoxSample>) => void) | null;
  error: ((m: string) => void) | null;
  extraction: { trackId: number; opts: { nbSamples: number } } | null;
  started: boolean;
  stopped: boolean;
}

function makeFakeMP4Box(
  emitter: (file: Mp4BoxFileLike, state: FakeFileState) => void,
): Mp4BoxNamespace {
  return {
    createFile(): Mp4BoxFileLike {
      const state: FakeFileState = {
        buffers: [],
        ready: null,
        samples: null,
        error: null,
        extraction: null,
        started: false,
        stopped: false,
      };
      const file: Mp4BoxFileLike = {
        get onReady() {
          return state.ready;
        },
        set onReady(handler) {
          state.ready = handler;
        },
        get onError() {
          return state.error;
        },
        set onError(handler) {
          state.error = handler;
        },
        get onSamples() {
          return state.samples;
        },
        set onSamples(handler) {
          state.samples = handler;
        },
        setExtractionOptions(trackId, _user, opts) {
          state.extraction = { trackId, opts };
        },
        appendBuffer(buffer) {
          state.buffers.push(buffer as ArrayBuffer);
          return state.buffers.length;
        },
        start() {
          state.started = true;
        },
        flush() {
          emitter(file, state);
        },
        stop() {
          state.stopped = true;
        },
      };
      return file;
    },
  };
}

describe('createMp4BoxSource', () => {
  it('builds an index from a single buffer with samples', async () => {
    const MP4Box = makeFakeMP4Box((_file, state) => {
      state.ready?.({
        tracks: [
          {
            id: 1,
            type: 'video',
            codec: 'avc1.42E01E',
            timescale: 90_000,
            duration: 270_000,
            movie_duration: 270_000,
            movie_timescale: 1000,
            nb_samples: 3,
            video: { width: 1280, height: 720 },
          },
        ],
        duration: 270_000,
        timescale: 1000,
      });
      state.samples?.(1, null, [
        sample({ number: 0, is_sync: true, dts: 0, cts: 0, duration: 3000 }),
      ]);
      state.samples?.(1, null, [sample({ number: 1, dts: 3000, cts: 3000, duration: 3000 })]);
      state.samples?.(1, null, [
        sample({ number: 2, is_sync: true, dts: 6000, cts: 6000, duration: 3000 }),
      ]);
    });

    const result = await createMp4BoxSource({
      MP4Box,
      data: new ArrayBuffer(16),
    });
    expect(result.codec).toBe('avc1.42E01E');
    expect(result.videoWidth).toBe(1280);
    expect(result.videoHeight).toBe(720);
    expect(result.index.frames).toHaveLength(3);
    expect(result.index.keyframeIndices).toEqual([0, 2]);
    expect(result.data).toHaveLength(3);
  });

  it('rejects when the file has no video track', async () => {
    const MP4Box = makeFakeMP4Box((_file, state) => {
      state.ready?.({
        tracks: [
          {
            id: 5,
            type: 'audio',
            codec: 'mp4a.40.2',
            timescale: 48_000,
            duration: 0,
            movie_duration: 0,
            movie_timescale: 1000,
            nb_samples: 0,
          },
        ],
        duration: 0,
        timescale: 1000,
      });
    });
    await expect(createMp4BoxSource({ MP4Box, data: new ArrayBuffer(8) })).rejects.toThrow(
      /no video track/,
    );
  });

  it('rejects when the requested trackId is missing', async () => {
    const MP4Box = makeFakeMP4Box((_file, state) => {
      state.ready?.({
        tracks: [
          {
            id: 1,
            type: 'video',
            codec: 'avc1.42E01E',
            timescale: 90_000,
            duration: 0,
            movie_duration: 0,
            movie_timescale: 1000,
            nb_samples: 0,
          },
        ],
        duration: 0,
        timescale: 1000,
      });
    });
    await expect(
      createMp4BoxSource({ MP4Box, data: new ArrayBuffer(8), trackId: 99 }),
    ).rejects.toThrow(/track id not found/);
  });

  it('propagates onError as a rejection', async () => {
    const MP4Box = makeFakeMP4Box((_file, state) => {
      state.error?.('bad atom');
    });
    await expect(createMp4BoxSource({ MP4Box, data: new ArrayBuffer(8) })).rejects.toThrow(
      /bad atom/,
    );
  });

  it('appends multiple chunks with monotonic fileStart offsets', async () => {
    let observed: number[] = [];
    const MP4Box = makeFakeMP4Box((_file, state) => {
      observed = state.buffers.map(
        (b) => (b as ArrayBuffer & { fileStart?: number }).fileStart ?? -1,
      );
      state.ready?.({
        tracks: [
          {
            id: 1,
            type: 'video',
            codec: 'avc1.42E01E',
            timescale: 90_000,
            duration: 0,
            movie_duration: 0,
            movie_timescale: 1000,
            nb_samples: 1,
            video: { width: 1, height: 1 },
          },
        ],
        duration: 0,
        timescale: 1000,
      });
      state.samples?.(1, null, [sample({ is_sync: true })]);
    });

    await createMp4BoxSource({
      MP4Box,
      data: [new ArrayBuffer(10), new ArrayBuffer(20), new ArrayBuffer(5)],
    });
    expect(observed).toEqual([0, 10, 30]);
  });
});
