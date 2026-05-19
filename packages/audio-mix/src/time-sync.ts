/**
 * Master/slave time synchroniser. The Web Audio mixer drives several
 * audio sources at once — the host video plus N commentary / alt-
 * language stems — and they will drift over a long session because
 * each `<audio>` / `<video>` element runs its own internal clock.
 *
 * The sync layer watches `master.currentTime` and the slave clocks; if
 * any slave drifts further than the threshold (default 50 ms), it
 * snaps the slave forward or backward. Below the threshold we leave
 * alone so the small natural variance does not turn into audible
 * resync pops.
 */

export interface ClockSource {
  /**
   * Reading returns the current playhead time in seconds; writing
   * should snap the underlying media element. Implementers typically
   * back this with a `<video>` / `<audio>` `currentTime` property.
   */
  currentTime: number;
}

export interface DriftSample {
  /** Slave time minus master time at the moment we sampled. */
  drift: number;
  /** Master timestamp the sample was taken at. */
  masterTime: number;
}

export interface TimeSyncOptions {
  master: ClockSource;
  slaves: ReadonlyArray<ClockSource>;
  /** Above this absolute drift the slave is snapped (seconds). Default 0.050. */
  thresholdSeconds?: number;
  /** Optional hook so callers can log resync events for QoE telemetry. */
  onResync?: (event: { slaveIndex: number; drift: number; masterTime: number }) => void;
}

const DEFAULT_THRESHOLD = 0.05;

export interface TimeSyncController {
  /** Measure drift across every slave; snap any slave outside the band. */
  tick(): ReadonlyArray<DriftSample>;
  /** Reset the controller — call before a seek so we don't snap during it. */
  reset(): void;
}

/**
 * Build a sync controller. Caller is responsible for invoking `tick()`
 * on a cadence appropriate to the media — usually inside the host's
 * `timeupdate` handler, so the controller piggybacks on the native
 * 4 Hz tick instead of running its own RAF loop.
 */
export function createTimeSync(opts: TimeSyncOptions): TimeSyncController {
  const threshold = Math.max(0, opts.thresholdSeconds ?? DEFAULT_THRESHOLD);

  return {
    tick() {
      const samples: DriftSample[] = [];
      const masterTime = opts.master.currentTime;
      for (let i = 0; i < opts.slaves.length; i += 1) {
        const slave = opts.slaves[i];
        if (!slave) continue;
        const drift = slave.currentTime - masterTime;
        samples.push({ drift, masterTime });
        if (Math.abs(drift) > threshold) {
          slave.currentTime = masterTime;
          opts.onResync?.({ slaveIndex: i, drift, masterTime });
        }
      }
      return samples;
    },

    reset() {
      // The current implementation is stateless apart from the hook —
      // resetting is a no-op today but the seam exists so future
      // hysteresis / averaging logic can clear its window without
      // breaking callers.
    },
  };
}

/**
 * Pure helper: would the given drift trigger a resync at this
 * threshold? Exposed so UI / telemetry layers can decide whether to
 * surface a "tracks drifted" warning without driving the snap.
 */
export function wouldResync(drift: number, thresholdSeconds = DEFAULT_THRESHOLD): boolean {
  return Math.abs(drift) > thresholdSeconds;
}
