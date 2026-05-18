import { BachPlayerElement } from '@bach/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { bindToBachHost, findBachHost } from './host-binding.js';

beforeAll(() => {
  if (!customElements.get('bach-player')) {
    customElements.define('bach-player', BachPlayerElement);
  }
});

describe('findBachHost', () => {
  it('returns the closest <bach-player> ancestor', () => {
    document.body.innerHTML = '<bach-player><div id="inner"></div></bach-player>';
    const inner = document.getElementById('inner');
    expect(inner).not.toBeNull();
    expect(findBachHost(inner as Element)?.tagName).toBe('BACH-PLAYER');
  });

  it('returns null when no host exists', () => {
    document.body.innerHTML = '<div id="orphan"></div>';
    expect(findBachHost(document.getElementById('orphan') as Element)).toBeNull();
  });
});

describe('bindToBachHost', () => {
  it('calls setup with the host and returns its teardown', () => {
    document.body.innerHTML = '<bach-player><span id="x"></span></bach-player>';
    const el = document.getElementById('x') as Element;
    let calls = 0;
    const teardown = bindToBachHost(el, (host) => {
      expect(host.tagName).toBe('BACH-PLAYER');
      calls += 1;
      return () => {
        calls += 10;
      };
    });
    expect(calls).toBe(1);
    teardown();
    expect(calls).toBe(11);
  });

  it('returns a no-op when no host is found', () => {
    document.body.innerHTML = '<div id="orphan"></div>';
    let invoked = false;
    const teardown = bindToBachHost(document.getElementById('orphan') as Element, () => {
      invoked = true;
    });
    expect(invoked).toBe(false);
    expect(() => teardown()).not.toThrow();
  });
});
