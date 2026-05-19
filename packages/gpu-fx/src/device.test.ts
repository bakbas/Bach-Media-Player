import { describe, expect, it, vi } from 'vitest';
import { acquireDevice, isWebGpuSupported } from './device.js';

describe('isWebGpuSupported', () => {
  it('returns true when a gpu shim is provided', () => {
    expect(isWebGpuSupported({ requestAdapter: async () => null })).toBe(true);
  });
  it('returns false in happy-dom (no navigator.gpu)', () => {
    expect(isWebGpuSupported()).toBe(false);
  });
});

describe('acquireDevice', () => {
  it('returns null when there is no gpu surface', async () => {
    expect(await acquireDevice()).toBeNull();
  });

  it('returns null when requestAdapter resolves to null', async () => {
    const gpu = { requestAdapter: vi.fn(async () => null) };
    expect(await acquireDevice({ gpu })).toBeNull();
  });

  it('returns the device when the adapter resolves', async () => {
    const device = { destroy: vi.fn() };
    const gpu = {
      requestAdapter: vi.fn(async () => ({ requestDevice: async () => device })),
    };
    const result = await acquireDevice({ gpu });
    expect(result?.device).toBe(device);
    expect(result?.acquired).toBe(true);
  });

  it('forwards powerPreference when provided', async () => {
    const gpu = {
      requestAdapter: vi.fn(async () => ({
        requestDevice: async () => ({ destroy: vi.fn() }),
      })),
    };
    await acquireDevice({ gpu, powerPreference: 'high-performance' });
    expect(gpu.requestAdapter).toHaveBeenCalledWith({ powerPreference: 'high-performance' });
  });

  it('returns null when the request throws', async () => {
    const gpu = {
      requestAdapter: vi.fn(async () => {
        throw new Error('no adapter');
      }),
    };
    expect(await acquireDevice({ gpu })).toBeNull();
  });
});
