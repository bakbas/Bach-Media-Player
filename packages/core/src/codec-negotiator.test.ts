import { describe, expect, it, vi } from 'vitest';
import {
  type CodecCapability,
  type MediaCapabilitiesLike,
  type PlaybackCandidate,
  pickBestCandidate,
  probeCandidate,
  scoreCapability,
  selectEngine,
} from './codec-negotiator.js';
import type { MediaEngine } from './engine.js';

const av1: PlaybackCandidate = {
  contentType: 'video/mp4; codecs="av01.0.05M.08"',
  width: 1920,
  height: 1080,
  framerate: 30,
  bitrate: 5_000_000,
};

const h264: PlaybackCandidate = {
  contentType: 'video/mp4; codecs="avc1.640028"',
  width: 1920,
  height: 1080,
  framerate: 30,
  bitrate: 5_000_000,
};

function mc(
  answers: Record<string, { supported: boolean; smooth: boolean; powerEfficient: boolean }>,
): MediaCapabilitiesLike {
  return {
    decodingInfo: async (config) => {
      const ct = config.video?.contentType ?? '';
      return answers[ct] ?? { supported: false, smooth: false, powerEfficient: false };
    },
  };
}

describe('scoreCapability', () => {
  const cap = (overrides: Partial<CodecCapability>): CodecCapability => ({
    candidate: av1,
    supported: true,
    smooth: true,
    powerEfficient: true,
    ...overrides,
  });

  it('returns -1 when unsupported', () => {
    expect(scoreCapability(cap({ supported: false }))).toBe(-1);
  });

  it('ranks smooth + efficient highest', () => {
    expect(scoreCapability(cap({}))).toBe(3);
    expect(scoreCapability(cap({ powerEfficient: false }))).toBe(2);
    expect(scoreCapability(cap({ smooth: false }))).toBe(1);
    expect(scoreCapability(cap({ smooth: false, powerEfficient: false }))).toBe(0);
  });
});

describe('probeCandidate', () => {
  it('forwards the candidate fields to decodingInfo', async () => {
    const decodingInfo = vi
      .fn()
      .mockResolvedValue({ supported: true, smooth: true, powerEfficient: false });
    const result = await probeCandidate(av1, { decodingInfo });
    expect(decodingInfo).toHaveBeenCalledWith({
      type: 'media-source',
      video: {
        contentType: av1.contentType,
        width: 1920,
        height: 1080,
        framerate: 30,
        bitrate: 5_000_000,
      },
    });
    expect(result.supported).toBe(true);
    expect(result.smooth).toBe(true);
    expect(result.powerEfficient).toBe(false);
  });

  it('includes keySystemConfiguration when DRM is required', async () => {
    const decodingInfo = vi
      .fn()
      .mockResolvedValue({ supported: true, smooth: true, powerEfficient: true });
    await probeCandidate({ ...av1, keySystem: 'com.widevine.alpha' }, { decodingInfo });
    const call = decodingInfo.mock.calls[0]?.[0];
    expect(call.keySystemConfiguration).toEqual({ keySystem: 'com.widevine.alpha' });
  });

  it('falls back to an unsupported result when decodingInfo throws', async () => {
    const decodingInfo = vi.fn().mockRejectedValue(new Error('not implemented'));
    const result = await probeCandidate(av1, { decodingInfo });
    expect(result.supported).toBe(false);
    expect(result.smooth).toBe(false);
    expect(result.powerEfficient).toBe(false);
  });
});

describe('pickBestCandidate', () => {
  it('returns null when no candidate is supported', () => {
    const caps: CodecCapability[] = [
      { candidate: av1, supported: false, smooth: false, powerEfficient: false },
      { candidate: h264, supported: false, smooth: false, powerEfficient: false },
    ];
    expect(pickBestCandidate(caps)).toBeNull();
  });

  it('prefers smooth + powerEfficient over a bare-supported alternative', () => {
    const caps: CodecCapability[] = [
      { candidate: av1, supported: true, smooth: false, powerEfficient: false },
      { candidate: h264, supported: true, smooth: true, powerEfficient: true },
    ];
    expect(pickBestCandidate(caps)?.candidate).toBe(h264);
  });

  it('keeps the first candidate when scores tie', () => {
    const caps: CodecCapability[] = [
      { candidate: av1, supported: true, smooth: true, powerEfficient: true },
      { candidate: h264, supported: true, smooth: true, powerEfficient: true },
    ];
    expect(pickBestCandidate(caps)?.candidate).toBe(av1);
  });
});

describe('selectEngine', () => {
  const fakeEngine = (name: string, handles = true): MediaEngine => ({
    name,
    canHandle: vi.fn().mockResolvedValue(handles),
    attach: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    on: vi.fn().mockReturnValue(() => {}),
  });

  it('returns the first engine that handles the source with a supported candidate', async () => {
    const hls = fakeEngine('hls');
    const dash = fakeEngine('dash');
    const result = await selectEngine({
      src: 'video.m3u8',
      engines: [hls, dash],
      candidatesByEngine: new Map([
        ['hls', [av1]],
        ['dash', [av1]],
      ]),
      mediaCapabilities: mc({
        [av1.contentType]: { supported: true, smooth: true, powerEfficient: true },
      }),
    });
    expect(result?.engine).toBe(hls);
    expect(result?.capability.candidate).toBe(av1);
    expect(dash.canHandle).not.toHaveBeenCalled();
  });

  it('skips engines whose canHandle is false', async () => {
    const hls = fakeEngine('hls', false);
    const dash = fakeEngine('dash', true);
    const result = await selectEngine({
      src: 'video.mpd',
      engines: [hls, dash],
      candidatesByEngine: new Map([
        ['hls', [av1]],
        ['dash', [av1]],
      ]),
      mediaCapabilities: mc({
        [av1.contentType]: { supported: true, smooth: false, powerEfficient: false },
      }),
    });
    expect(result?.engine).toBe(dash);
  });

  it('falls through to the next engine when no candidate is supported', async () => {
    const hls = fakeEngine('hls');
    const dash = fakeEngine('dash');
    const result = await selectEngine({
      src: 'video',
      engines: [hls, dash],
      candidatesByEngine: new Map([
        ['hls', [av1]],
        ['dash', [h264]],
      ]),
      mediaCapabilities: mc({
        [h264.contentType]: { supported: true, smooth: true, powerEfficient: true },
      }),
    });
    expect(result?.engine).toBe(dash);
    expect(result?.capability.candidate).toBe(h264);
  });

  it('returns null when nothing can play', async () => {
    const hls = fakeEngine('hls');
    const result = await selectEngine({
      src: 'video',
      engines: [hls],
      candidatesByEngine: new Map([['hls', [av1, h264]]]),
      mediaCapabilities: mc({}),
    });
    expect(result).toBeNull();
  });
});
