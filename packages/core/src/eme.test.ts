import { describe, expect, it, vi } from 'vitest';
import { type EmeContext, INITIAL_EME_CONTEXT, createLicenseSession, emeReducer } from './eme.js';

const message = new Uint8Array([1, 2, 3]);
const license = new Uint8Array([9, 8, 7]);

describe('emeReducer', () => {
  it('moves idle → requesting on request', () => {
    const { context, effect } = emeReducer(INITIAL_EME_CONTEXT, { type: 'request', message });
    expect(context.state).toBe('requesting');
    expect(context.attempts).toBe(1);
    expect(effect.updateSession).toBeUndefined();
  });

  it('emits updateSession on response and moves to active', () => {
    const after = emeReducer(INITIAL_EME_CONTEXT, { type: 'request', message }).context;
    const { context, effect } = emeReducer(after, { type: 'response', license });
    expect(context.state).toBe('active');
    expect(context.lastError).toBeNull();
    expect(effect.updateSession).toBe(license);
  });

  it('ignores response when not requesting', () => {
    const { context, effect } = emeReducer(INITIAL_EME_CONTEXT, { type: 'response', license });
    expect(context.state).toBe('idle');
    expect(effect.updateSession).toBeUndefined();
  });

  it('moves to failed on error and surfaces the error effect', () => {
    const requesting = emeReducer(INITIAL_EME_CONTEXT, { type: 'request', message }).context;
    const { context, effect } = emeReducer(requesting, {
      type: 'error',
      code: 'license-fetch-failed',
      message: 'boom',
    });
    expect(context.state).toBe('failed');
    expect(context.lastError).toEqual({ code: 'license-fetch-failed', message: 'boom' });
    expect(effect.surfaceError).toEqual({ code: 'license-fetch-failed', message: 'boom' });
  });

  it('retries when failed and attempts < 3, incrementing the attempt counter', () => {
    let ctx: EmeContext = INITIAL_EME_CONTEXT;
    ctx = emeReducer(ctx, { type: 'request', message }).context;
    ctx = emeReducer(ctx, { type: 'error', code: 'x', message: 'y' }).context;
    const { context } = emeReducer(ctx, { type: 'retry' });
    expect(context.state).toBe('requesting');
    expect(context.lastError).toBeNull();
    expect(context.attempts).toBe(2);
  });

  it('refuses to retry past MAX_ATTEMPTS', () => {
    let ctx: EmeContext = INITIAL_EME_CONTEXT;
    for (let i = 0; i < 3; i += 1) {
      ctx = emeReducer(ctx, { type: 'request', message }).context;
      ctx = emeReducer(ctx, { type: 'error', code: 'x', message: 'y' }).context;
      const retry = emeReducer(ctx, { type: 'retry' });
      ctx = retry.context;
    }
    expect(ctx.state).toBe('failed');
    expect(ctx.attempts).toBe(3);
  });

  it('returns to idle on close', () => {
    const requesting = emeReducer(INITIAL_EME_CONTEXT, { type: 'request', message }).context;
    const { context } = emeReducer(requesting, { type: 'close' });
    expect(context).toEqual(INITIAL_EME_CONTEXT);
  });

  it('is a no-op when receiving a duplicate request mid-flight', () => {
    const first = emeReducer(INITIAL_EME_CONTEXT, { type: 'request', message }).context;
    const second = emeReducer(first, { type: 'request', message });
    expect(second.context).toBe(first);
  });
});

describe('createLicenseSession', () => {
  it('updates the session when the fetcher resolves', async () => {
    const onSessionUpdate = vi.fn();
    const onError = vi.fn();
    const session = createLicenseSession({
      fetcher: async () => license,
      onSessionUpdate,
      onError,
    });
    await session.request(message);
    expect(onSessionUpdate).toHaveBeenCalledWith(license);
    expect(onError).not.toHaveBeenCalled();
    expect(session.context.state).toBe('active');
  });

  it('surfaces an error when the fetcher rejects', async () => {
    const onSessionUpdate = vi.fn();
    const onError = vi.fn();
    const session = createLicenseSession({
      fetcher: async () => {
        throw new Error('network');
      },
      onSessionUpdate,
      onError,
    });
    await session.request(message);
    expect(onSessionUpdate).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith({ code: 'license-fetch-failed', message: 'network' });
    expect(session.context.state).toBe('failed');
  });

  it('close() resets the context', async () => {
    const session = createLicenseSession({
      fetcher: async () => license,
      onSessionUpdate: () => {},
    });
    await session.request(message);
    session.close();
    expect(session.context.state).toBe('idle');
    expect(session.context.attempts).toBe(0);
  });
});
