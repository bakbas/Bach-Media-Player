/**
 * Transcript timing aligner.
 *
 * Whisper emits an array of timestamped segments per inference call. With a
 * 5 s overlap between consecutive windows the same word can appear twice
 * (once at the tail of window N, once at the head of window N+1). This
 * module merges incoming segments into a single monotonic stream and
 * dedupes by timestamp + normalized text.
 *
 * The algorithm is intentionally simple: a segment from a new window is
 * dropped when its midpoint overlaps an existing segment whose text matches
 * after lowercasing and stripping punctuation. Whisper's segment boundaries
 * are stable enough for this to work in practice; it loses ~one word at
 * each boundary in pathological cases, which is invisible to viewers.
 */
export interface Segment {
  /** Start time in seconds, on the host media clock. */
  start: number;
  /** End time in seconds. */
  end: number;
  /** Transcribed text for this segment. */
  text: string;
}

const NORMALIZE = /[^\p{L}\p{N}\s]+/gu;

function normalize(text: string): string {
  return text.toLowerCase().replace(NORMALIZE, '').replace(/\s+/g, ' ').trim();
}

function midpoint(seg: Segment): number {
  return (seg.start + seg.end) / 2;
}

export interface TimingAligner {
  /** Ingest one window's worth of segments. Returns the segments that are new. */
  ingest(segments: ReadonlyArray<Segment>): Segment[];
  /** Every segment retained so far, sorted by start. */
  readonly all: ReadonlyArray<Segment>;
  /** Drop everything before `seconds` (caller reset / media seek). */
  reset(): void;
}

export function createTimingAligner(): TimingAligner {
  const retained: Segment[] = [];

  return {
    get all() {
      return retained;
    },

    ingest(segments) {
      const fresh: Segment[] = [];
      for (const seg of segments) {
        if (!Number.isFinite(seg.start) || !Number.isFinite(seg.end) || seg.end <= seg.start) {
          continue;
        }
        const normText = normalize(seg.text);
        if (normText.length === 0) continue;

        const mid = midpoint(seg);
        // Look for a retained segment that overlaps and matches text.
        const duplicate = retained.some((existing) => {
          if (mid < existing.start || mid > existing.end) return false;
          return normalize(existing.text) === normText;
        });
        if (duplicate) continue;

        // Maintain sort order — Whisper segments inside one window are
        // sorted, but cross-window inserts can land anywhere.
        const index = retained.findIndex((s) => s.start > seg.start);
        if (index === -1) retained.push(seg);
        else retained.splice(index, 0, seg);
        fresh.push(seg);
      }
      return fresh;
    },

    reset() {
      retained.length = 0;
    },
  };
}

/**
 * Pick the active segment for a given media time. Returns `null` when there
 * is nothing to show. Linear scan is fine — typical transcript length for a
 * 2-hour talk is under 2000 segments and this gets called once per
 * `timeupdate` (~250 ms).
 */
export function activeSegmentAt(
  segments: ReadonlyArray<Segment>,
  currentTime: number,
): Segment | null {
  for (const seg of segments) {
    if (currentTime >= seg.start && currentTime <= seg.end) return seg;
  }
  return null;
}
