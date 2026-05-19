export {
  type CrossfadeCurve,
  type CrossfadePoint,
  crossfadeAt,
  dbToGain,
  gainToDb,
  sampleCrossfadeCurve,
} from './crossfade.js';

export {
  type ClockSource,
  type DriftSample,
  type TimeSyncController,
  type TimeSyncOptions,
  createTimeSync,
  wouldResync,
} from './time-sync.js';

export {
  type AnalyserNodeLike,
  type AudioContextLike,
  type AudioNodeLike,
  type AudioParamLike,
  type CrossfadeOptions,
  type GainNodeLike,
  type MediaElementSourceLike,
  type Mixer,
  type MixerOptions,
  type TrackHandle,
  type TrackInput,
  createMixer,
} from './mixer.js';

export { BachAudioMixElement, BachAudioTrackElement } from './element.js';
