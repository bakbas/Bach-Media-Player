import { describe, expect, it, vi } from 'vitest';
import { createFrameCache } from './frame-cache.js';

// Helper that widens string literals so test fixtures align with
// CachedFrame<string> under exactOptionalPropertyTypes.
const entry = (index: number, bytes: number, value: string, release?: (v: string) => void) => ({
  index,
  bytes,
  value,
  ...(release ? { release } : {}),
});

describe('createFrameCache', () => {
  it('stores and retrieves entries', () => {
    const cache = createFrameCache<string>({ maxBytes: 1024 });
    cache.put(entry(0, 100, 'a'));
    expect(cache.get(0)).toBe('a');
    expect(cache.size).toBe(1);
    expect(cache.bytes).toBe(100);
  });

  it('returns null for misses', () => {
    const cache = createFrameCache<string>();
    expect(cache.get(42)).toBeNull();
  });

  it('evicts the least recently used when the budget is exceeded', () => {
    const cache = createFrameCache<string>({ maxBytes: 200 });
    cache.put(entry(0, 100, 'a'));
    cache.put(entry(1, 100, 'b'));
    // Touching `0` makes it most-recently-used.
    expect(cache.get(0)).toBe('a');
    cache.put(entry(2, 100, 'c'));
    // `b` (index 1) is the oldest now and should have been evicted.
    expect(cache.get(1)).toBeNull();
    expect(cache.get(0)).toBe('a');
    expect(cache.get(2)).toBe('c');
  });

  it('replaces an existing entry rather than double-counting bytes', () => {
    const cache = createFrameCache<string>({ maxBytes: 1024 });
    cache.put(entry(0, 100, 'a'));
    cache.put(entry(0, 50, 'b'));
    expect(cache.get(0)).toBe('b');
    expect(cache.bytes).toBe(50);
    expect(cache.size).toBe(1);
  });

  it('calls release() on evicted entries', () => {
    const release = vi.fn();
    const cache = createFrameCache<string>({ maxBytes: 100 });
    cache.put(entry(0, 60, 'a', release));
    cache.put(entry(1, 60, 'b'));
    expect(release).toHaveBeenCalledWith('a');
  });

  it('drops an entry larger than the budget without flushing the cache', () => {
    const release = vi.fn();
    const cache = createFrameCache<string>({ maxBytes: 200 });
    cache.put(entry(0, 100, 'a'));
    cache.put(entry(1, 500, 'too-big', release));
    expect(release).toHaveBeenCalledWith('too-big');
    expect(cache.get(1)).toBeNull();
    expect(cache.get(0)).toBe('a');
  });

  it('clear() releases every entry', () => {
    const release = vi.fn();
    const cache = createFrameCache<string>({ maxBytes: 1024 });
    cache.put(entry(0, 100, 'a', release));
    cache.put(entry(1, 100, 'b', release));
    cache.clear();
    expect(release).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(0);
    expect(cache.bytes).toBe(0);
  });

  it('swallows release() exceptions', () => {
    const cache = createFrameCache<string>({ maxBytes: 50 });
    cache.put(
      entry(0, 40, 'a', () => {
        throw new Error('boom');
      }),
    );
    expect(() => cache.put(entry(1, 40, 'b'))).not.toThrow();
  });
});
