import { describe, expect, it, vi } from 'vitest';
import { type ClockSource, createTimeSync, wouldResync } from './time-sync.js';

function clock(initial: number): ClockSource {
  let t = initial;
  return {
    get currentTime() {
      return t;
    },
    set currentTime(value) {
      t = value;
    },
  };
}

describe('wouldResync', () => {
  it('returns false within the default 50 ms band', () => {
    expect(wouldResync(0.02)).toBe(false);
    expect(wouldResync(-0.04)).toBe(false);
  });
  it('returns true beyond the band', () => {
    expect(wouldResync(0.06)).toBe(true);
    expect(wouldResync(-0.2)).toBe(true);
  });
  it('honours a custom threshold', () => {
    expect(wouldResync(0.1, 0.2)).toBe(false);
    expect(wouldResync(0.3, 0.2)).toBe(true);
  });
});

describe('createTimeSync.tick', () => {
  it('reports drift for every slave', () => {
    const master = clock(10);
    const a = clock(10.02);
    const b = clock(9.95);
    const controller = createTimeSync({ master, slaves: [a, b] });
    const samples = controller.tick();
    expect(samples).toHaveLength(2);
    expect(samples[0]?.drift).toBeCloseTo(0.02, 5);
    expect(samples[1]?.drift).toBeCloseTo(-0.05, 5);
  });

  it('snaps slaves that drift past the threshold and fires onResync', () => {
    const master = clock(20);
    const drifted = clock(20.2);
    const inBand = clock(20.01);
    const onResync = vi.fn();
    const controller = createTimeSync({
      master,
      slaves: [drifted, inBand],
      thresholdSeconds: 0.05,
      onResync,
    });
    controller.tick();
    expect(drifted.currentTime).toBe(20);
    expect(inBand.currentTime).toBe(20.01);
    expect(onResync).toHaveBeenCalledTimes(1);
    expect(onResync.mock.calls[0]?.[0]).toEqual({
      slaveIndex: 0,
      drift: expect.closeTo(0.2, 5),
      masterTime: 20,
    });
  });

  it('handles a custom threshold of zero (always resync)', () => {
    const master = clock(5);
    const slave = clock(5.001);
    const onResync = vi.fn();
    const controller = createTimeSync({
      master,
      slaves: [slave],
      thresholdSeconds: 0,
      onResync,
    });
    controller.tick();
    expect(slave.currentTime).toBe(5);
    expect(onResync).toHaveBeenCalledTimes(1);
  });

  it('reset() is callable and idempotent (placeholder for future state)', () => {
    const controller = createTimeSync({ master: clock(0), slaves: [] });
    expect(() => {
      controller.reset();
      controller.reset();
    }).not.toThrow();
  });
});
