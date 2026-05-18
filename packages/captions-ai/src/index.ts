export { BachCaptionsElement } from './element.js';
export {
  BachCaptionsConsentElement,
  type CaptionsConsentResolveEvent,
} from './consent-element.js';
export {
  type AudioChunk,
  type AudioChunkerOptions,
  WHISPER_SAMPLE_RATE,
  WINDOW_SAMPLES,
  STRIDE_SAMPLES,
  WINDOW_SECONDS,
  OVERLAP_SECONDS,
  createAudioChunker,
  downmixToMono,
  resampleLinear,
} from './audio-chunker.js';
export {
  type Segment,
  type TimingAligner,
  activeSegmentAt,
  createTimingAligner,
} from './timing-aligner.js';
export {
  type TranscriptionController,
  type TranscriptionControllerOptions,
  createTranscriptionController,
} from './controller.js';
export {
  type ModelCacheProbe,
  type TranscribeOptions,
  type TranscriptionEngine,
  type WhisperModelKey,
  WHISPER_MODELS,
  createCacheApiProbe,
} from './whisper.js';
export {
  type PermissionResolution,
  type PermissionState,
  readPermission,
  resolvePermission,
  writePermission,
} from './permission.js';
