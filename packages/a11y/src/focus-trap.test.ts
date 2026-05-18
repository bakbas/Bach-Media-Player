import { describe, expect, it } from 'vitest';
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
});
