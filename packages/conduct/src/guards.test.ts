import { describe, expect, it } from 'vitest';
import { createRateLimiter, createSequenceGuard, dampenColorIfReduced } from './guards.js';

describe('createRateLimiter', () => {
  it('allows up to N manifests per second', () => {
    const t = 0;
    const limiter = createRateLimiter({ perSecond: 3, now: () => t });
    expect(limiter.allow()).toBe(true);
    expect(limiter.allow()).toBe(true);
    expect(limiter.allow()).toBe(true);
    expect(limiter.allow()).toBe(false);
  });

  it('clears the window after one second', () => {
    let t = 0;
    const limiter = createRateLimiter({ perSecond: 2, now: () => t });
    limiter.allow();
    limiter.allow();
    expect(limiter.allow()).toBe(false);
    t = 1100;
    expect(limiter.allow()).toBe(true);
  });

  it('reset drops the entire sliding window', () => {
    const t = 0;
    const limiter = createRateLimiter({ perSecond: 1, now: () => t });
    limiter.allow();
    expect(limiter.allow()).toBe(false);
    limiter.reset();
    expect(limiter.allow()).toBe(true);
  });
});

describe('createSequenceGuard', () => {
  it('accepts strictly increasing sequences', () => {
    const guard = createSequenceGuard();
    expect(guard.accept(0)).toBe(true);
    expect(guard.accept(1)).toBe(true);
    expect(guard.accept(1)).toBe(false);
    expect(guard.accept(5)).toBe(true);
  });

  it('drops replayed numbers and NaN', () => {
    const guard = createSequenceGuard({ initial: 10 });
    expect(guard.accept(5)).toBe(false);
    expect(guard.accept(Number.NaN)).toBe(false);
    expect(guard.accept(11)).toBe(true);
    expect(guard.last).toBe(11);
  });

  it('resume(at) repositions the cursor', () => {
    const guard = createSequenceGuard();
    guard.resume(100);
    expect(guard.accept(50)).toBe(false);
    expect(guard.accept(101)).toBe(true);
  });
});

describe('dampenColorIfReduced', () => {
  it('passes the new value through when reduced motion is off', () => {
    expect(dampenColorIfReduced('#000000', '#ffffff', { prefersReducedMotion: false })).toBe(
      '#ffffff',
    );
  });

  it('clamps colour deltas when reduced motion is on', () => {
    const out = dampenColorIfReduced('#000000', '#ffffff', {
      prefersReducedMotion: true,
      maxDelta: 0.2,
    });
    // 0.2 * 255 = 51 → output should sit ~51 / 255 above black.
    const channel = Number.parseInt(out.slice(1, 3), 16);
    expect(channel).toBeLessThanOrEqual(52);
    expect(channel).toBeGreaterThanOrEqual(50);
  });

  it('passes through unparseable values rather than corrupting them', () => {
    expect(
      dampenColorIfReduced('not-a-color', 'oklch(0.5 0.1 30)', {
        prefersReducedMotion: true,
      }),
    ).toBe('oklch(0.5 0.1 30)');
  });

  it('handles 3-digit hex inputs', () => {
    const out = dampenColorIfReduced('#000', '#fff', {
      prefersReducedMotion: true,
      maxDelta: 0.5,
    });
    expect(out).toMatch(/^#[0-9a-f]{6}$/);
  });
});
