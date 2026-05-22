import { describe, expect, it, vi } from 'vitest';
import { getFocusable, trapFocus } from './focus-trap.js';

function setup(html: string): HTMLDivElement {
  document.body.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.tabIndex = -1;
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
  return wrapper;
}

describe('getFocusable', () => {
  it('finds buttons, links, inputs', () => {
    const w = setup(`
      <button id="a">A</button>
      <a href="#" id="b">B</a>
      <input id="c" />
      <span>not focusable</span>
    `);
    const ids = getFocusable(w).map((el) => el.id);
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('skips hidden and aria-hidden elements', () => {
    const w = setup(`
      <button id="a">A</button>
      <button id="b" hidden>B</button>
      <button id="c" aria-hidden="true">C</button>
      <button id="d">D</button>
    `);
    expect(getFocusable(w).map((el) => el.id)).toEqual(['a', 'd']);
  });

  it('skips elements with tabindex=-1', () => {
    const w = setup('<button id="a">A</button><button id="b" tabindex="-1">B</button>');
    expect(getFocusable(w).map((el) => el.id)).toEqual(['a']);
  });
});

describe('trapFocus', () => {
  it('Shift+Tab from the first focusable jumps to the last', () => {
    const w = setup('<button id="a">A</button><button id="b">B</button><button id="c">C</button>');
    const untrap = trapFocus(w);
    const a = document.getElementById('a') as HTMLButtonElement;
    const c = document.getElementById('c') as HTMLButtonElement;
    a.focus();
    expect(document.activeElement).toBe(a);
    a.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(c);
    untrap();
  });

  it('Tab from the last focusable wraps to the first', () => {
    const w = setup('<button id="a">A</button><button id="b">B</button>');
    const untrap = trapFocus(w);
    const a = document.getElementById('a') as HTMLButtonElement;
    const b = document.getElementById('b') as HTMLButtonElement;
    b.focus();
    b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(a);
    untrap();
  });

  it('untrap() restores the previously focused element', () => {
    const before = document.createElement('button');
    document.body.appendChild(before);
    before.focus();
    expect(document.activeElement).toBe(before);
    const w = setup('<button id="x">X</button>');
    document.body.insertBefore(before, w);
    before.focus();
    const untrap = trapFocus(w);
    expect(document.activeElement).toBe(document.getElementById('x'));
    untrap();
    expect(document.activeElement).toBe(before);
  });

  it('Tab inside an empty container preventDefaults and refocuses the container', () => {
    const w = setup('<span>nothing tabbable here</span>');
    const untrap = trapFocus(w);
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    const preventDefault = vi.spyOn(event, 'preventDefault');
    w.dispatchEvent(event);
    expect(preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(w);
    untrap();
  });

  it('descends into open shadow roots when collecting focusable descendants', () => {
    // Host is itself tab-eligible (button) so it lands in the direct list;
    // getFocusable then walks into its shadow root and picks up the inner
    // focusable. This is the path Bach UI controls follow.
    const w = setup('<button id="host">host</button>');
    const host = w.querySelector('#host') as HTMLElement;
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('button');
    inner.id = 'inside-shadow';
    shadow.appendChild(inner);
    const ids = getFocusable(w).map((el) => el.id);
    expect(ids).toContain('inside-shadow');
  });
});
