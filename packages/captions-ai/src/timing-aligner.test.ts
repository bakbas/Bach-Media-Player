import { describe, expect, it } from 'vitest';
import { type Segment, activeSegmentAt, createTimingAligner } from './timing-aligner.js';

const seg = (start: number, end: number, text: string): Segment => ({ start, end, text });

describe('TimingAligner', () => {
  it('retains every segment from a single window', () => {
    const a = createTimingAligner();
    const segments = [seg(0, 2, 'hello world'), seg(2, 4, 'second segment')];
    const fresh = a.ingest(segments);
    expect(fresh).toEqual(segments);
    expect(a.all).toHaveLength(2);
  });

  it('drops a duplicate that overlaps with matching text', () => {
    const a = createTimingAligner();
    a.ingest([seg(28, 30, 'and then we continue')]);
    const fresh = a.ingest([seg(28.1, 30.2, 'And then we continue.')]);
    expect(fresh).toHaveLength(0);
    expect(a.all).toHaveLength(1);
  });

  it('keeps non-duplicate overlaps when text differs', () => {
    const a = createTimingAligner();
    a.ingest([seg(28, 30, 'first phrase')]);
    const fresh = a.ingest([seg(29, 31, 'something else entirely')]);
    expect(fresh).toHaveLength(1);
    expect(a.all).toHaveLength(2);
  });

  it('inserts late-arriving segments in sorted order', () => {
    const a = createTimingAligner();
    a.ingest([seg(10, 12, 'ten')]);
    a.ingest([seg(5, 6, 'five'), seg(20, 22, 'twenty')]);
    expect(a.all.map((s) => s.start)).toEqual([5, 10, 20]);
  });

  it('rejects segments with non-finite or inverted times', () => {
    const a = createTimingAligner();
    const fresh = a.ingest([
      seg(Number.NaN, 1, 'nan'),
      seg(5, 3, 'inverted'),
      seg(0, Number.POSITIVE_INFINITY, 'inf'),
    ]);
    expect(fresh).toHaveLength(0);
    expect(a.all).toHaveLength(0);
  });

  it('rejects empty / whitespace-only text', () => {
    const a = createTimingAligner();
    a.ingest([seg(1, 2, '   '), seg(2, 3, '!!!')]);
    expect(a.all).toHaveLength(0);
  });

  it('reset clears state', () => {
    const a = createTimingAligner();
    a.ingest([seg(0, 1, 'hi')]);
    a.reset();
    expect(a.all).toHaveLength(0);
  });
});

describe('activeSegmentAt', () => {
  const list = [seg(0, 2, 'a'), seg(3, 5, 'b'), seg(5, 7, 'c')];

  it('returns the segment whose range contains the time', () => {
    expect(activeSegmentAt(list, 1)?.text).toBe('a');
    expect(activeSegmentAt(list, 4)?.text).toBe('b');
  });
  it('returns null in the gap', () => {
    expect(activeSegmentAt(list, 2.5)).toBeNull();
  });
  it('returns the first match when ranges touch', () => {
    expect(activeSegmentAt(list, 5)?.text).toBe('b');
  });
});
