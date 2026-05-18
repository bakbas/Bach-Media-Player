import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from './event-bus.js';

type Events = {
  ready: () => void;
  error: (err: { code: number; message: string }) => void;
  progress: (ranges: ReadonlyArray<[number, number]>) => void;
};

describe('createEventBus', () => {
  it('delivers args to all subscribers of an event', () => {
    const bus = createEventBus<Events>();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('error', a);
    bus.on('error', b);
    bus.emit('error', { code: 1, message: 'oops' });
    expect(a).toHaveBeenCalledWith({ code: 1, message: 'oops' });
    expect(b).toHaveBeenCalledWith({ code: 1, message: 'oops' });
  });

  it('no-ops emits with no listeners', () => {
    const bus = createEventBus<Events>();
    expect(() => bus.emit('ready')).not.toThrow();
  });

  it('on() returns an unsubscribe function', () => {
    const bus = createEventBus<Events>();
    const handler = vi.fn();
    const off = bus.on('ready', handler);
    off();
    bus.emit('ready');
    expect(handler).not.toHaveBeenCalled();
  });

  it('clear() drops every listener', () => {
    const bus = createEventBus<Events>();
    const handler = vi.fn();
    bus.on('ready', handler);
    bus.on('progress', handler);
    bus.clear();
    bus.emit('ready');
    bus.emit('progress', [[0, 1]]);
    expect(handler).not.toHaveBeenCalled();
  });
});
