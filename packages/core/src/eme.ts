/**
 * EME (Encrypted Media Extensions) orchestrator.
 *
 * Responsibilities, in scope for Phase 1:
 *  - Track the state of one license exchange per CDM session as a pure reducer
 *    that can be unit-tested without touching any browser API.
 *  - Provide a thin runtime wrapper (`createLicenseSession`) that ties the
 *    reducer to a `licenseFetcher` callback supplied by the engine adapter.
 *
 * Out of scope here (deferred to the engine adapters in `@bach/engine-hls`
 * and `@bach/engine-dash`):
 *  - Picking the key system (handled by the codec negotiator).
 *  - Creating `MediaKeys` / `MediaKeySession` objects (engines own this).
 *  - Persisting licenses (operator concern).
 *
 * The orchestrator never touches the license bytes — it forwards them
 * verbatim. See SECURITY.md for the key-discipline rationale.
 */

export type EmeState = 'idle' | 'requesting' | 'active' | 'failed';

export interface EmeContext {
  state: EmeState;
  attempts: number;
  lastError: { code: string; message: string } | null;
}

export type EmeEvent =
  | { type: 'request'; message: Uint8Array }
  | { type: 'response'; license: Uint8Array }
  | { type: 'error'; code: string; message: string }
  | { type: 'retry' }
  | { type: 'close' };

export interface EmeEffect {
  /** Forward bytes to the underlying MediaKeySession (set by the engine). */
  updateSession?: Uint8Array;
  /** Surface as a `bach:drm-failed` event. */
  surfaceError?: { code: string; message: string };
}

export const INITIAL_EME_CONTEXT: EmeContext = {
  state: 'idle',
  attempts: 0,
  lastError: null,
};

const MAX_ATTEMPTS = 3;

/**
 * Pure reducer for the EME state machine.
 *
 * Transitions:
 *   idle       → requesting   on `request`
 *   requesting → active       on `response` (emits `updateSession`)
 *   requesting → failed       on `error`    (emits `surfaceError`)
 *   failed     → requesting   on `retry`    (if attempts < MAX_ATTEMPTS)
 *   *          → idle         on `close`
 */
export function emeReducer(
  ctx: EmeContext,
  event: EmeEvent,
): { context: EmeContext; effect: EmeEffect } {
  switch (event.type) {
    case 'request':
      if (ctx.state === 'requesting') return { context: ctx, effect: {} };
      return {
        context: { state: 'requesting', attempts: ctx.attempts + 1, lastError: null },
        effect: {},
      };

    case 'response':
      if (ctx.state !== 'requesting') return { context: ctx, effect: {} };
      return {
        context: { ...ctx, state: 'active', lastError: null },
        effect: { updateSession: event.license },
      };

    case 'error':
      return {
        context: {
          ...ctx,
          state: 'failed',
          lastError: { code: event.code, message: event.message },
        },
        effect: { surfaceError: { code: event.code, message: event.message } },
      };

    case 'retry':
      if (ctx.state !== 'failed') return { context: ctx, effect: {} };
      if (ctx.attempts >= MAX_ATTEMPTS) return { context: ctx, effect: {} };
      return {
        context: { state: 'requesting', attempts: ctx.attempts + 1, lastError: null },
        effect: {},
      };

    case 'close':
      return { context: INITIAL_EME_CONTEXT, effect: {} };
  }
}

export interface LicenseSession {
  /** Current orchestrator context. */
  readonly context: EmeContext;
  /**
   * Drive the state machine with a CDM-generated license request. Resolves
   * once the corresponding response has been applied (or the request fails).
   */
  request(message: Uint8Array): Promise<void>;
  /** Reset to `idle` and forget the last error. */
  close(): void;
}

export type LicenseFetcher = (message: Uint8Array) => Promise<Uint8Array>;

export interface LicenseSessionOptions {
  fetcher: LicenseFetcher;
  /** Called whenever the session emits an `updateSession` effect. */
  onSessionUpdate: (license: Uint8Array) => void;
  /** Called whenever the session emits a `surfaceError` effect. */
  onError?: (err: { code: string; message: string }) => void;
}

/**
 * Runtime wrapper that drives the reducer using a license fetcher (typically
 * `fetch(licenseUrl, { method: 'POST', body: message })` inside an engine
 * adapter). Network and CDM concerns stay out of the pure reducer.
 */
export function createLicenseSession(opts: LicenseSessionOptions): LicenseSession {
  let context = INITIAL_EME_CONTEXT;

  const dispatch = (event: EmeEvent): EmeEffect => {
    const { context: next, effect } = emeReducer(context, event);
    context = next;
    if (effect.updateSession) opts.onSessionUpdate(effect.updateSession);
    if (effect.surfaceError) opts.onError?.(effect.surfaceError);
    return effect;
  };

  return {
    get context() {
      return context;
    },

    async request(message: Uint8Array): Promise<void> {
      dispatch({ type: 'request', message });
      try {
        const license = await opts.fetcher(message);
        dispatch({ type: 'response', license });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'license request failed';
        dispatch({ type: 'error', code: 'license-fetch-failed', message });
      }
    },

    close(): void {
      dispatch({ type: 'close' });
    },
  };
}
