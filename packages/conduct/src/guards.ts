/**
 * Safety guards for incoming conducted manifests:
 *
 *   - Rate limit. A flicker / strobe attack tries to push many
 *     contrasting manifests in quick succession. The viewer drops
 *     anything beyond `N` manifests per second.
 *   - Photosensitive epilepsy guard. When `prefers-reduced-motion` is
 *     set, contrast deltas above a threshold are clamped.
 *   - Sequence ordering. Out-of-order or replayed sequence numbers
 *     are dropped silently.
 */

export interface RateLimiterOptions {
  /** Manifests per second budget. Default 10. */
  perSecond?: number;
  /** Clock override for tests. */
  now?: () => number;
}

export interface RateLimiter {
  /** Returns `true` when the manifest may pass; `false` when dropped. */
  allow(): boolean;
  /** Drop the internal sliding window — e.g. on resume after pause. */
  reset(): void;
}

const DEFAULT_RATE = 10;

export function createRateLimiter(opts: RateLimiterOptions = {}): RateLimiter {
  const budget = Math.max(1, opts.perSecond ?? DEFAULT_RATE);
  const now = opts.now ?? defaultNow;
  let window: number[] = [];

  return {
    allow() {
      const t = now();
      // Drop timestamps older than one second.
      const cutoff = t - 1000;
      while (window.length > 0 && (window[0] ?? 0) <= cutoff) window.shift();
      if (window.length >= budget) return false;
      window.push(t);
      return true;
    },
    reset() {
      window = [];
    },
  };
}

function defaultNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export interface SequenceGuardOptions {
  /** Initial last-seen sequence. -1 means "accept anything". */
  initial?: number;
}

export interface SequenceGuard {
  /** Returns `true` when `seq` is strictly newer than the last accepted. */
  accept(seq: number): boolean;
  /** Reset after a reconnect / subscribe with `resumeAt`. */
  resume(at: number): void;
  readonly last: number;
}

export function createSequenceGuard(opts: SequenceGuardOptions = {}): SequenceGuard {
  let last = opts.initial ?? -1;
  return {
    accept(seq) {
      if (!Number.isFinite(seq)) return false;
      if (seq <= last) return false;
      last = seq;
      return true;
    },
    resume(at) {
      last = at;
    },
    get last() {
      return last;
    },
  };
}

export interface ReducedMotionOptions {
  /** Matches the host's `matchMedia('(prefers-reduced-motion: reduce)')`. */
  prefersReducedMotion: boolean;
  /** Maximum allowed delta (0..1) per channel for color tokens. */
  maxDelta?: number;
}

/**
 * When reduced-motion is requested, project an incoming hex/oklch
 * colour towards the existing one so the transition is muted. The
 * input strings are parsed best-effort; values the parser cannot
 * handle (gradients, function chains) are passed through unchanged
 * so the schema layer still gets to reject them on its own terms.
 */
export function dampenColorIfReduced(
  current: string,
  next: string,
  opts: ReducedMotionOptions,
): string {
  if (!opts.prefersReducedMotion) return next;
  const max = opts.maxDelta ?? 0.15;
  const a = parseHex(current);
  const b = parseHex(next);
  if (!a || !b) return next;
  return formatHex(
    clampDelta(a[0], b[0], max),
    clampDelta(a[1], b[1], max),
    clampDelta(a[2], b[2], max),
  );
}

function parseHex(input: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(input.trim());
  if (!m) return null;
  const hex = m[1] ?? '';
  if (hex.length === 3) {
    return [
      Number.parseInt(hex[0]! + hex[0]!, 16),
      Number.parseInt(hex[1]! + hex[1]!, 16),
      Number.parseInt(hex[2]! + hex[2]!, 16),
    ];
  }
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function formatHex(r: number, g: number, b: number): string {
  const to = (n: number): string => Math.round(n).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function clampDelta(current: number, next: number, max: number): number {
  const limit = max * 255;
  const delta = next - current;
  if (Math.abs(delta) <= limit) return next;
  return current + Math.sign(delta) * limit;
}
