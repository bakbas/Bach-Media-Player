/**
 * Byte-budgeted LRU cache for decoded video frames. Callers store
 * `VideoFrame`-shaped entries keyed by frame index; the cache evicts the
 * least recently used frame when adding would exceed the budget. The cache
 * never decodes anything itself — it is just the storage layer.
 *
 * The cached value is opaque (`unknown` to this module) so the unit tests
 * can store cheap stand-ins without spinning up real WebCodecs.
 */

export interface CachedFrame<T> {
  index: number;
  /** Bytes the frame occupies in GPU / system memory (estimated). */
  bytes: number;
  /** Frame payload — typically a `VideoFrame`. */
  value: T;
  /** Called when the entry is evicted so callers can `.close()` GPU frames. */
  release?: (value: T) => void;
}

export interface FrameCache<T> {
  get(index: number): T | null;
  put(entry: CachedFrame<T>): void;
  /** Drop and release every entry. */
  clear(): void;
  readonly size: number;
  readonly bytes: number;
}

export interface FrameCacheOptions {
  /** Byte budget. Defaults to 64 MB — a few seconds of 1080p RGB frames. */
  maxBytes?: number;
}

const DEFAULT_BUDGET = 64 * 1024 * 1024;

export function createFrameCache<T>(opts: FrameCacheOptions = {}): FrameCache<T> {
  const maxBytes = Math.max(0, opts.maxBytes ?? DEFAULT_BUDGET);
  const map = new Map<number, CachedFrame<T>>();
  let bytes = 0;

  const release = (entry: CachedFrame<T>): void => {
    try {
      entry.release?.(entry.value);
    } catch {
      // Caller-supplied release that throws should not break eviction.
    }
  };

  return {
    get(index) {
      const entry = map.get(index);
      if (!entry) return null;
      // Move to most-recently-used by re-inserting.
      map.delete(index);
      map.set(index, entry);
      return entry.value;
    },

    put(entry) {
      const existing = map.get(entry.index);
      if (existing) {
        bytes -= existing.bytes;
        map.delete(entry.index);
        release(existing);
      }
      // If a single entry is bigger than the budget, drop it instead of
      // evicting the entire cache; never store something we can't keep.
      if (entry.bytes > maxBytes) {
        release(entry);
        return;
      }
      map.set(entry.index, entry);
      bytes += entry.bytes;
      // Evict from the oldest end until we're back under budget.
      while (bytes > maxBytes) {
        const oldest = map.keys().next();
        if (oldest.done) break;
        const victim = map.get(oldest.value);
        if (!victim) break;
        map.delete(oldest.value);
        bytes -= victim.bytes;
        release(victim);
      }
    },

    clear() {
      for (const entry of map.values()) release(entry);
      map.clear();
      bytes = 0;
    },

    get size() {
      return map.size;
    },
    get bytes() {
      return bytes;
    },
  };
}
