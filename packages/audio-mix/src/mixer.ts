import { type CrossfadeCurve, sampleCrossfadeCurve } from './crossfade.js';

/**
 * Structural types for the bits of Web Audio we drive. We avoid the
 * global lib types so the package compiles where `lib.dom` is absent
 * (Node-side type checks pick this up) and so unit tests can pass
 * lightweight fakes without minting a JSDOM AudioContext.
 */
export interface AudioParamLike {
  value: number;
  setValueCurveAtTime(values: Float32Array, startTime: number, duration: number): void;
  cancelScheduledValues(time: number): void;
  setValueAtTime(value: number, time: number): void;
}

export interface AudioNodeLike {
  connect(target: AudioNodeLike): AudioNodeLike;
  disconnect(): void;
}

export interface GainNodeLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}

export interface AnalyserNodeLike extends AudioNodeLike {
  fftSize: number;
  readonly frequencyBinCount: number;
  smoothingTimeConstant: number;
  getByteFrequencyData(array: Uint8Array): void;
}

export interface MediaElementSourceLike extends AudioNodeLike {}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly destination: AudioNodeLike;
  createGain(): GainNodeLike;
  createAnalyser(): AnalyserNodeLike;
  createMediaElementSource(media: HTMLMediaElement): MediaElementSourceLike;
}

export interface TrackInput {
  id: string;
  /** Pre-built node (mic, oscillator, custom worklet, etc.). */
  node?: AudioNodeLike;
  /** Or a media element the mixer wraps into a MediaElementSource. */
  media?: HTMLMediaElement;
  /** Initial gain. Defaults to 1. */
  gain?: number;
}

export interface TrackHandle {
  readonly id: string;
  readonly gain: GainNodeLike;
  readonly source: AudioNodeLike;
}

export interface CrossfadeOptions {
  durationSeconds?: number;
  curve?: CrossfadeCurve;
  /** Number of values pushed into `setValueCurveAtTime`. Default 128. */
  resolution?: number;
}

export interface MixerOptions {
  context: AudioContextLike;
  /** Optional analyser bin count override (must be a power of two). */
  fftSize?: number;
}

export interface Mixer {
  readonly context: AudioContextLike;
  readonly master: GainNodeLike;
  readonly analyser: AnalyserNodeLike;
  addTrack(track: TrackInput): TrackHandle;
  removeTrack(id: string): boolean;
  getTrack(id: string): TrackHandle | null;
  crossfade(fromId: string, toId: string, opts?: CrossfadeOptions): void;
  setGain(id: string, gain: number): void;
  /** Read one frame of spectral data (FFT magnitudes 0..255). */
  sampleSpectrum(out?: Uint8Array): Uint8Array;
  dispose(): void;
}

const DEFAULT_CROSSFADE_DURATION = 1;
const DEFAULT_CROSSFADE_RESOLUTION = 128;
const DEFAULT_FFT_SIZE = 256;

/**
 * Build a multi-track mixer. The graph is:
 *
 *   track.source → track.gain
 *                          ↘
 *                            master.gain → analyser → context.destination
 *                          ↗
 *   commentary.source → commentary.gain
 *
 * Each `addTrack()` call wires one branch in. The analyser sits on the
 * master bus so the spectral overlay reflects whatever is actually
 * audible at the end — single-track sums and crossfades alike.
 */
export function createMixer(opts: MixerOptions): Mixer {
  const { context } = opts;
  const master = context.createGain();
  master.gain.value = 1;

  const analyser = context.createAnalyser();
  analyser.fftSize = opts.fftSize ?? DEFAULT_FFT_SIZE;
  analyser.smoothingTimeConstant = 0.7;

  master.connect(analyser).connect(context.destination);

  const tracks = new Map<string, TrackHandle>();

  const resolveSource = (track: TrackInput): AudioNodeLike => {
    if (track.node && track.media) {
      throw new Error('Bach mixer: track input must specify either `node` or `media`, not both');
    }
    if (track.node) return track.node;
    if (track.media) return context.createMediaElementSource(track.media);
    throw new Error('Bach mixer: track input requires a `node` or `media` source');
  };

  const ensureBoth = (a: string, b: string): { from: TrackHandle; to: TrackHandle } => {
    const from = tracks.get(a);
    const to = tracks.get(b);
    if (!from || !to) {
      throw new Error(`Bach mixer: crossfade requires both tracks (${a}, ${b})`);
    }
    return { from, to };
  };

  return {
    context,
    master,
    analyser,

    addTrack(track) {
      if (tracks.has(track.id)) {
        throw new Error(`Bach mixer: track id "${track.id}" already registered`);
      }
      const source = resolveSource(track);
      const gain = context.createGain();
      gain.gain.value = track.gain ?? 1;
      source.connect(gain).connect(master);
      const handle: TrackHandle = { id: track.id, gain, source };
      tracks.set(track.id, handle);
      return handle;
    },

    removeTrack(id) {
      const handle = tracks.get(id);
      if (!handle) return false;
      handle.source.disconnect();
      handle.gain.disconnect();
      tracks.delete(id);
      return true;
    },

    getTrack(id) {
      return tracks.get(id) ?? null;
    },

    crossfade(fromId, toId, options = {}) {
      const { from, to } = ensureBoth(fromId, toId);
      const duration = Math.max(0, options.durationSeconds ?? DEFAULT_CROSSFADE_DURATION);
      const curve = options.curve ?? 'equal-power';
      const resolution = Math.max(2, options.resolution ?? DEFAULT_CROSSFADE_RESOLUTION);
      const { gainA, gainB } = sampleCrossfadeCurve(curve, resolution);

      const now = context.currentTime;
      from.gain.gain.cancelScheduledValues(now);
      to.gain.gain.cancelScheduledValues(now);
      from.gain.gain.setValueAtTime(from.gain.gain.value, now);
      to.gain.gain.setValueAtTime(to.gain.gain.value, now);

      if (duration === 0) {
        from.gain.gain.setValueAtTime(gainA[gainA.length - 1] ?? 0, now);
        to.gain.gain.setValueAtTime(gainB[gainB.length - 1] ?? 1, now);
        return;
      }
      from.gain.gain.setValueCurveAtTime(gainA, now, duration);
      to.gain.gain.setValueCurveAtTime(gainB, now, duration);
    },

    setGain(id, gain) {
      const handle = tracks.get(id);
      if (!handle) return;
      handle.gain.gain.cancelScheduledValues(context.currentTime);
      handle.gain.gain.value = gain;
    },

    sampleSpectrum(out) {
      const target = out ?? new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(target);
      return target;
    },

    dispose() {
      for (const handle of tracks.values()) {
        handle.source.disconnect();
        handle.gain.disconnect();
      }
      tracks.clear();
      analyser.disconnect();
      master.disconnect();
    },
  };
}
