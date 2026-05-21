import type { BachPlayerElement } from '@bach/core';
import type { Recorder } from './store.js';

/**
 * Wire a `Recorder` to the player's signals state + DOM events. The
 * collector subscribes to the slice the QoE taxonomy needs (no audio
 * track buffers, no GPU frame data — those stay local) and writes a
 * single event per host-level change.
 *
 * Returns an `unsubscribe` so consumers can detach cleanly. The
 * collector itself never decides whether to upload — that's the
 * uploader's job.
 */

export interface CollectorOptions {
  host: BachPlayerElement;
  recorder: Recorder;
  /** Optional clock for tests. */
  now?: () => number;
}

export type CollectorUnsubscribe = () => void;

export function attachCollector(opts: CollectorOptions): CollectorUnsubscribe {
  const now = opts.now ?? Date.now;
  const session = opts.recorder.session;

  // Session start
  void opts.recorder.record({ type: 'session-start', session, ts: now(), data: {} });

  const teardowns: Array<() => void> = [];

  const onPlay = (): void => {
    void opts.recorder.record({ type: 'playing', session, ts: now(), data: {} });
  };
  const onPause = (): void => {
    void opts.recorder.record({ type: 'pause', session, ts: now(), data: {} });
  };
  const onLoadStart = (): void => {
    void opts.recorder.record({
      type: 'loadstart',
      session,
      ts: now(),
      data: { src: opts.host.state.src.value },
    });
  };
  const onLoadedMetadata = (): void => {
    void opts.recorder.record({
      type: 'loadedmetadata',
      session,
      ts: now(),
      data: { duration: opts.host.state.duration.value },
    });
  };
  const onSeeked = (): void => {
    void opts.recorder.record({
      type: 'seek',
      session,
      ts: now(),
      data: { to: opts.host.state.currentTime.value },
    });
  };
  const onRateChange = (): void => {
    const video = opts.host.video;
    if (!video) return;
    void opts.recorder.record({
      type: 'ratechange',
      session,
      ts: now(),
      data: { rate: video.playbackRate },
    });
  };
  const onWaiting = (): void => {
    void opts.recorder.record({
      type: 'rebuffer',
      session,
      ts: now(),
      data: { at: opts.host.state.currentTime.value },
    });
  };
  const onError = (): void => {
    const err = opts.host.state.error.value;
    void opts.recorder.record({
      type: 'error',
      session,
      ts: now(),
      data: err ? { code: err.code, message: err.message } : {},
    });
  };

  // Bach-level events from sibling packages.
  const onConductApplied = (): void => {
    void opts.recorder.record({ type: 'conduct-applied', session, ts: now(), data: {} });
  };
  const onConductRejected = (event: Event): void => {
    const detail = (event as CustomEvent<{ reason?: string }>).detail;
    void opts.recorder.record({
      type: 'conduct-rejected',
      session,
      ts: now(),
      data: detail?.reason ? { reason: detail.reason } : {},
    });
  };

  const video = opts.host.video;
  if (video) {
    const events: Array<[string, EventListener]> = [
      ['play', onPlay],
      ['pause', onPause],
      ['loadstart', onLoadStart],
      ['loadedmetadata', onLoadedMetadata],
      ['seeked', onSeeked],
      ['ratechange', onRateChange],
      ['waiting', onWaiting],
      ['error', onError],
    ];
    for (const [type, handler] of events) {
      video.addEventListener(type, handler);
      teardowns.push(() => video.removeEventListener(type, handler));
    }
  }

  opts.host.addEventListener('bach:conduct-applied', onConductApplied);
  opts.host.addEventListener('bach:conduct-rejected', onConductRejected);
  teardowns.push(() => opts.host.removeEventListener('bach:conduct-applied', onConductApplied));
  teardowns.push(() => opts.host.removeEventListener('bach:conduct-rejected', onConductRejected));

  return () => {
    void opts.recorder.record({ type: 'session-end', session, ts: now(), data: {} });
    for (const teardown of teardowns) teardown();
  };
}
