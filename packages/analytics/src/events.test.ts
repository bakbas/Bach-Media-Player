import { describe, expect, it } from 'vitest';
import { type QoeEventBase, isKnownEventType, matchesFilter } from './events.js';

function event(over: Partial<QoeEventBase>): QoeEventBase {
  return {
    id: 1,
    ts: 1_700_000_000,
    session: 'session-1',
    type: 'playing',
    data: {},
    ...over,
  };
}

describe('isKnownEventType', () => {
  it('accepts every taxonomy entry', () => {
    for (const t of [
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
    ]) {
      expect(isKnownEventType(t)).toBe(true);
    }
  });
  it('rejects free-form strings', () => {
    expect(isKnownEventType('arbitrary')).toBe(false);
  });
});

describe('matchesFilter', () => {
  it('returns true when no filter is provided', () => {
    expect(matchesFilter(event({}), {})).toBe(true);
  });
  it('filters by single type', () => {
    expect(matchesFilter(event({ type: 'playing' }), { type: 'pause' })).toBe(false);
    expect(matchesFilter(event({ type: 'playing' }), { type: 'playing' })).toBe(true);
  });
  it('filters by array of types', () => {
    expect(matchesFilter(event({ type: 'seek' }), { type: ['playing', 'pause'] })).toBe(false);
    expect(matchesFilter(event({ type: 'seek' }), { type: ['seek', 'rebuffer'] })).toBe(true);
  });
  it('filters by session', () => {
    expect(matchesFilter(event({ session: 'a' }), { session: 'b' })).toBe(false);
    expect(matchesFilter(event({ session: 'a' }), { session: 'a' })).toBe(true);
  });
  it('filters by time bounds (inclusive)', () => {
    expect(matchesFilter(event({ ts: 100 }), { since: 200 })).toBe(false);
    expect(matchesFilter(event({ ts: 100 }), { since: 100 })).toBe(true);
    expect(matchesFilter(event({ ts: 500 }), { until: 400 })).toBe(false);
    expect(matchesFilter(event({ ts: 500 }), { until: 500 })).toBe(true);
  });
});
