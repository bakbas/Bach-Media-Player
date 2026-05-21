/**
 * QoE event taxonomy. Open schema — every published event field is
 * listed here so analytics consumers can plan dashboards without
 * scraping the source. The taxonomy is intentionally narrow: we
 * record what every player needs (load times, buffering, errors,
 * playback rate, captions / FX toggles), not what one host happens to
 * want.
 *
 * Every event is a JSON object so the sink (IndexedDB today, custom
 * relays tomorrow) does not need a schema migration when a field is
 * added — just write the new field and existing consumers ignore it.
 */

export type QoeEventType =
  | 'session-start'
  | 'session-end'
  | 'src-change'
  | 'loadstart'
  | 'loadedmetadata'
  | 'playing'
  | 'pause'
  | 'rebuffer'
  | 'ratechange'
  | 'seek'
  | 'error'
  | 'captions-toggle'
  | 'fx-applied'
  | 'theme-applied'
  | 'conduct-applied'
  | 'conduct-rejected';

export interface QoeEventBase {
  /** Monotonic per-session id. Filled by the store. */
  readonly id: number;
  /** Unix epoch ms when the event was captured. */
  readonly ts: number;
  /** Stable session id so events can be grouped across page refreshes. */
  readonly session: string;
  readonly type: QoeEventType;
  /** Free-form payload — JSON-serialisable. */
  readonly data: Record<string, unknown>;
}

/**
 * Inputs the store accepts. The store fills in id and ts. `session`
 * comes from the host (usually a UUID generated once per
 * `<bach-player>` connect).
 */
export interface QoeEventDraft {
  type: QoeEventType;
  session: string;
  data?: Record<string, unknown>;
  ts?: number;
}

/** Read-only constraint helper. */
export interface QoeFilter {
  type?: QoeEventType | ReadonlyArray<QoeEventType>;
  session?: string;
  /** Inclusive lower bound (epoch ms). */
  since?: number;
  /** Inclusive upper bound (epoch ms). */
  until?: number;
}

const KNOWN_TYPES: ReadonlySet<QoeEventType> = new Set([
  'session-start',
  'session-end',
  'src-change',
  'loadstart',
  'loadedmetadata',
  'playing',
  'pause',
  'rebuffer',
  'ratechange',
  'seek',
  'error',
  'captions-toggle',
  'fx-applied',
  'theme-applied',
  'conduct-applied',
  'conduct-rejected',
]);

export function isKnownEventType(type: string): type is QoeEventType {
  return KNOWN_TYPES.has(type as QoeEventType);
}

/**
 * Match a stored event against a filter. Pure, used both by the
 * IndexedDB sink (after a coarse `getAll`) and by the in-memory test
 * harness so the predicates match exactly.
 */
export function matchesFilter(event: QoeEventBase, filter: QoeFilter): boolean {
  if (filter.type !== undefined) {
    const types = Array.isArray(filter.type) ? filter.type : [filter.type];
    if (!types.includes(event.type)) return false;
  }
  if (filter.session !== undefined && event.session !== filter.session) return false;
  if (filter.since !== undefined && event.ts < filter.since) return false;
  if (filter.until !== undefined && event.ts > filter.until) return false;
  return true;
}
