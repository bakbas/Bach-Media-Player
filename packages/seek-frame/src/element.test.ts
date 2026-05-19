import { BachPlayerElement } from '@bach/core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BachSeekFrameElement } from './element.js';
import type { FrameStepper } from './frame-stepper.js';

beforeAll(() => {
  if (!customElements.get('bach-player')) {
    customElements.define('bach-player', BachPlayerElement);
  }
  if (!customElements.get('bach-seek-frame')) {
    customElements.define('bach-seek-frame', BachSeekFrameElement);
  }
});

beforeEach(() => {
  document.body.innerHTML = '';
});

function makeStepper(): FrameStepper & {
  at: ReturnType<typeof vi.fn>;
  step: ReturnType<typeof vi.fn>;
} {
  return {
    position: 7,
    at: vi.fn(async () => 'at-frame'),
    step: vi.fn(async (delta: number) => `step:${delta}`),
    async prev() {
      return null;
    },
    async next() {
      return null;
    },
  } as unknown as FrameStepper & {
    at: ReturnType<typeof vi.fn>;
    step: ReturnType<typeof vi.fn>;
  };
}

function mount(): { host: BachPlayerElement; element: BachSeekFrameElement } {
  document.body.innerHTML = '<bach-player></bach-player>';
  const host = document.querySelector('bach-player') as BachPlayerElement;
  const element = document.createElement('bach-seek-frame') as BachSeekFrameElement;
  host.appendChild(element);
  return { host, element };
}

describe('<bach-seek-frame>', () => {
  it('delegates at() to the configured stepper and emits bach:frame', async () => {
    const { element } = mount();
    const stepper = makeStepper();
    element.setStepper(stepper);
    const listener = vi.fn();
    element.addEventListener('bach:frame', listener);

    const value = await element.at(2.5);
    expect(value).toBe('at-frame');
    expect(stepper.at).toHaveBeenCalledWith(2.5);
    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail).toEqual({ frame: 'at-frame', position: 7 });
  });

  it('prev() and next() pass delta=-1 and delta=+1 through step()', async () => {
    const { element } = mount();
    const stepper = makeStepper();
    element.setStepper(stepper);
    await element.prev();
    await element.next();
    expect(stepper.step.mock.calls.map((c) => c[0])).toEqual([-1, 1]);
  });

  it('keyboard "," / "." trigger prev / next on the host', async () => {
    const { host, element } = mount();
    const stepper = makeStepper();
    element.setStepper(stepper);
    host.dispatchEvent(new KeyboardEvent('keydown', { key: ',', bubbles: true }));
    host.dispatchEvent(new KeyboardEvent('keydown', { key: '.', bubbles: true }));
    // step() is awaited inside the handler; flush microtasks before asserting.
    await Promise.resolve();
    await Promise.resolve();
    expect(stepper.step.mock.calls.map((c) => c[0])).toEqual([-1, 1]);
  });

  it('keyboard shortcuts ignore modifier-held strokes', () => {
    const { host, element } = mount();
    const stepper = makeStepper();
    element.setStepper(stepper);
    host.dispatchEvent(new KeyboardEvent('keydown', { key: ',', ctrlKey: true, bubbles: true }));
    expect(stepper.step).not.toHaveBeenCalled();
  });

  it('no-ops without a host or without a stepper', async () => {
    const orphan = document.createElement('bach-seek-frame') as BachSeekFrameElement;
    document.body.appendChild(orphan);
    await expect(orphan.next()).resolves.toBeNull();

    const { element } = mount();
    await expect(element.at(0)).resolves.toBeNull();
  });

  it('detaches the listener on disconnect', async () => {
    const { host, element } = mount();
    const stepper = makeStepper();
    element.setStepper(stepper);
    element.remove();
    host.dispatchEvent(new KeyboardEvent('keydown', { key: '.', bubbles: true }));
    await Promise.resolve();
    expect(stepper.step).not.toHaveBeenCalled();
  });
});
