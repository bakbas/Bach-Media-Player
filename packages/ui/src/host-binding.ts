import type { BachPlayerElement } from '@bach/core';

/**
 * Setup callback executed once the nearest <bach-player> ancestor is found.
 * The return value, if any, is treated as a teardown and called on disconnect.
 * `void` lets the caller omit the return when there is nothing to clean up.
 */
// biome-ignore lint/suspicious/noConfusingVoidType: setup callbacks have a teardown-or-nothing return contract
export type HostSetup = (host: BachPlayerElement) => void | (() => void);

/**
 * Walk up the DOM (including across shadow roots) from `el` looking for the
 * closest `<bach-player>` ancestor. Returns `null` if none exists; the UI
 * control should refuse to render in that case.
 *
 * `Element.closest` does not cross shadow boundaries on its own, so we step
 * out through `getRootNode()` when the closest call returns nothing.
 */
export function findBachHost(el: Element): BachPlayerElement | null {
  let current: Element | null = el;
  while (current) {
    const found = current.closest<BachPlayerElement>('bach-player');
    if (found) return found;
    const root = current.getRootNode();
    if (root instanceof ShadowRoot) {
      current = root.host;
    } else {
      return null;
    }
  }
  return null;
}

/**
 * Inside `connectedCallback`, find the host player and run the setup.
 * Returns a teardown function for `disconnectedCallback`. If no host is
 * found the setup is skipped and a no-op teardown is returned — the caller
 * never has to null-check.
 */
export function bindToBachHost(self: Element, setup: HostSetup): () => void {
  const host = findBachHost(self);
  if (!host) return () => {};
  const teardown = setup(host);
  return teardown ?? (() => {});
}
