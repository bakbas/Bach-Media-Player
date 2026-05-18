/**
 * Typed event bus used by every engine adapter (and any plugin that needs a
 * named-event surface). Three reasons it lives in `@bach/core`:
 *
 *  1. Engines share an identical event signature; keeping the implementation
 *     in one place avoids 30 lines of casts in three packages.
 *  2. The type plumbing for variadic handlers is annoying enough that we
 *     want to write it once.
 *  3. Bundle cost is ~150 bytes, well within the core budget.
 */

type EventMap = Record<string, (...args: never[]) => void>;

export interface EventBus<Events extends EventMap> {
  on<E extends keyof Events>(event: E, handler: Events[E]): () => void;
  emit<E extends keyof Events>(event: E, ...args: Parameters<Events[E]>): void;
  /** Drop every listener — used by engine `destroy()` paths. */
  clear(): void;
}

type AnyHandler = (...args: never[]) => void;

export function createEventBus<Events extends EventMap>(): EventBus<Events> {
  const listeners = new Map<keyof Events, Set<AnyHandler>>();

  return {
    on(event, handler) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set<AnyHandler>();
        listeners.set(event, set);
      }
      set.add(handler as AnyHandler);
      return () => {
        listeners.get(event)?.delete(handler as AnyHandler);
      };
    },

    emit(event, ...args) {
      const set = listeners.get(event);
      if (!set) return;
      for (const handler of set) {
        (handler as (...a: unknown[]) => void)(...(args as unknown[]));
      }
    },

    clear() {
      listeners.clear();
    },
  };
}
