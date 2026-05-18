import { type Signal, computed, signal } from '@preact/signals-core';

export interface PlayerStateSnapshot {
  src: string | null;
  currentTime: number;
  duration: number;
  paused: boolean;
  muted: boolean;
  volume: number;
  readyState: number;
  buffered: ReadonlyArray<[number, number]>;
  error: { code: number; message: string } | null;
  headless: boolean;
}

export interface PlayerState {
  src: Signal<string | null>;
  currentTime: Signal<number>;
  duration: Signal<number>;
  paused: Signal<boolean>;
  muted: Signal<boolean>;
  volume: Signal<number>;
  readyState: Signal<number>;
  buffered: Signal<ReadonlyArray<[number, number]>>;
  error: Signal<{ code: number; message: string } | null>;
  headless: Signal<boolean>;
  snapshot(): PlayerStateSnapshot;
}

export function createPlayerState(initial?: Partial<PlayerStateSnapshot>): PlayerState {
  const src = signal<string | null>(initial?.src ?? null);
  const currentTime = signal(initial?.currentTime ?? 0);
  const duration = signal(initial?.duration ?? Number.NaN);
  const paused = signal(initial?.paused ?? true);
  const muted = signal(initial?.muted ?? false);
  const volume = signal(initial?.volume ?? 1);
  const readyState = signal(initial?.readyState ?? 0);
  const buffered = signal<ReadonlyArray<[number, number]>>(initial?.buffered ?? []);
  const error = signal<{ code: number; message: string } | null>(initial?.error ?? null);
  const headless = signal(initial?.headless ?? false);

  const snap = computed<PlayerStateSnapshot>(() => ({
    src: src.value,
    currentTime: currentTime.value,
    duration: duration.value,
    paused: paused.value,
    muted: muted.value,
    volume: volume.value,
    readyState: readyState.value,
    buffered: buffered.value,
    error: error.value,
    headless: headless.value,
  }));

  return {
    src,
    currentTime,
    duration,
    paused,
    muted,
    volume,
    readyState,
    buffered,
    error,
    headless,
    snapshot: () => snap.value,
  };
}
