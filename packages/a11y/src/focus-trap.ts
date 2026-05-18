const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'audio[controls]',
  'video[controls]',
  'details>summary:first-of-type',
];

interface FocusableElement extends HTMLElement {
  focus(): void;
}

/**
 * Collect the focusable descendants of `container` in DOM order. Closed
 * shadow roots are not traversed; if a control wants to participate it
 * must use `mode: 'open'` (which all Bach UI controls do).
 */
export function getFocusable(container: ParentNode): FocusableElement[] {
  const direct = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS.join(',')));
  const result: FocusableElement[] = [];
  for (const el of direct) {
    if (isFocusable(el)) result.push(el as FocusableElement);
    if (el.shadowRoot) {
      for (const inner of getFocusable(el.shadowRoot)) result.push(inner);
    }
  }
  return result;
}

function isFocusable(el: HTMLElement): boolean {
  if (el.hasAttribute('hidden')) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  // tabindex="-1" opts the element out of sequential tab navigation,
  // even when it is otherwise focusable (button, link, etc.).
  if (el.getAttribute('tabindex') === '-1') return false;
  return true;
}

/**
 * Trap Tab cycling inside `container`. Returns an `untrap()` that removes
 * the listener and restores the previously focused element. Use this when
 * the player enters fullscreen so screen-reader users do not Tab away into
 * the page chrome they cannot see.
 */
export function trapFocus(container: HTMLElement): () => void {
  const previouslyFocused = document.activeElement as HTMLElement | null;

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab') return;
    const focusable = getFocusable(container);
    if (focusable.length === 0) {
      event.preventDefault();
      container.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey) {
      if (active === first || !container.contains(active)) {
        event.preventDefault();
        last?.focus();
      }
    } else {
      if (active === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };

  container.addEventListener('keydown', onKeyDown);
  const focusable = getFocusable(container);
  (focusable[0] ?? container).focus();

  return () => {
    container.removeEventListener('keydown', onKeyDown);
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
  };
}
