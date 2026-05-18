import { describe, expect, it } from 'vitest';
import { createPlayerState } from './state.js';

describe('createPlayerState', () => {
  it('returns sensible defaults', () => {
    const s = createPlayerState();
    const snap = s.snapshot();
    expect(snap.src).toBeNull();
    expect(snap.currentTime).toBe(0);
    expect(snap.paused).toBe(true);
    expect(snap.muted).toBe(false);
    expect(snap.volume).toBe(1);
    expect(snap.headless).toBe(false);
    expect(Number.isNaN(snap.duration)).toBe(true);
  });

  it('applies provided initial values', () => {
    const s = createPlayerState({ src: 'x.m3u8', muted: true, headless: true, volume: 0.5 });
    const snap = s.snapshot();
    expect(snap.src).toBe('x.m3u8');
    expect(snap.muted).toBe(true);
    expect(snap.headless).toBe(true);
    expect(snap.volume).toBe(0.5);
  });

  it('reflects signal writes in the snapshot', () => {
    const s = createPlayerState();
    s.currentTime.value = 12.5;
    s.paused.value = false;
    s.buffered.value = [[0, 10]];
    const snap = s.snapshot();
    expect(snap.currentTime).toBe(12.5);
    expect(snap.paused).toBe(false);
    expect(snap.buffered).toEqual([[0, 10]]);
  });
});
