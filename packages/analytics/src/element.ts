import type { BachPlayerElement } from '@bach/core';
import { type CollectorUnsubscribe, attachCollector } from './collector.js';
import { createIndexedDbStore } from './indexeddb.js';
import { type Recorder, createMemoryStore, createRecorder } from './store.js';
import type { QoeStore } from './store.js';

/**
 * `<bach-analytics>` — opt-in declarative entry point. On connect it
 * builds an IndexedDB-backed recorder (or in-memory fallback when
 * IndexedDB is missing) and attaches a collector to the closest
 * `<bach-player>`. Disconnect tears the listeners down and writes a
 * `session-end` event.
 *
 * The element is non-visual; consumers grab `el.recorder` /
 * `el.store` when they want to drive their own uploader / dashboard.
 */
export class BachAnalyticsElement extends HTMLElement {
  static get observedAttributes(): readonly string[] {
    return ['session'];
  }

  #store: QoeStore | null = null;
  #recorder: Recorder | null = null;
  #teardown: CollectorUnsubscribe | null = null;

  get store(): QoeStore | null {
    return this.#store;
  }

  get recorder(): Recorder | null {
    return this.#recorder;
  }

  connectedCallback(): void {
    const host = this.closest<BachPlayerElement>('bach-player');
    if (!host) return;
    const sessionAttr = this.getAttribute('session');
    this.#store = typeof indexedDB !== 'undefined' ? createIndexedDbStore() : createMemoryStore();
    this.#recorder = createRecorder({
      store: this.#store,
      ...(sessionAttr ? { session: sessionAttr } : {}),
    });
    this.#teardown = attachCollector({ host, recorder: this.#recorder });
  }

  disconnectedCallback(): void {
    this.#teardown?.();
    this.#teardown = null;
    this.#recorder = null;
    this.#store = null;
  }
}
