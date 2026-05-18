import type { PlayerState } from './state.js';

interface VideoLike {
  currentTime: number;
  duration: number;
  paused: boolean;
  muted: boolean;
  volume: number;
  readyState: number;
  buffered: { length: number; start(i: number): number; end(i: number): number };
  error: { code: number; message: string } | null;
  addEventListener(type: string, handler: (event: Event) => void): void;
  removeEventListener(type: string, handler: (event: Event) => void): void;
}

const TRACKED_EVENTS = [
  'loadedmetadata',
  'durationchange',
  'timeupdate',
  'progress',
  'play',
  'pause',
  'volumechange',
  'ratechange',
  'ended',
  'error',
  'waiting',
  'canplay',
  'seeking',
  'seeked',
] as const;

function bufferedRanges(video: VideoLike): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < video.buffered.length; i += 1) {
    out.push([video.buffered.start(i), video.buffered.end(i)]);
  }
  return out;
}

/**
 * Wire a `<video>` (or any minimally compatible media-like object) to the
 * signals-based player state. Returns an `unbind` function that removes all
 * listeners — the element's `disconnectedCallback` must call it to avoid
 * leaking handlers across hot reloads.
 *
 * The binding is *read-only*: events on the video update the state. Code
 * that wants to change playback (play, seek, volume) writes to the video
 * element directly and lets the binding mirror the result back. This avoids
 * the "two sources of truth" trap that plagues mediaelement wrappers.
 */
export function bindVideoToState(video: VideoLike, state: PlayerState): () => void {
  const sync = (): void => {
    state.currentTime.value = video.currentTime;
    state.duration.value = video.duration;
    state.paused.value = video.paused;
    state.muted.value = video.muted;
    state.volume.value = video.volume;
    state.readyState.value = video.readyState;
    state.buffered.value = bufferedRanges(video);
    state.error.value = video.error
      ? { code: video.error.code, message: video.error.message }
      : null;
  };

  const handler = (): void => sync();

  for (const type of TRACKED_EVENTS) video.addEventListener(type, handler);
  sync();

  return () => {
    for (const type of TRACKED_EVENTS) video.removeEventListener(type, handler);
  };
}
