/**
 * WebGPU adapter and device detection. We accept the navigator-side
 * `GPU` interface as a parameter so consumers can pass a stub during
 * tests; in the real runtime it is `navigator.gpu`.
 *
 * The shape we depend on is intentionally tiny — full WebGPU types
 * pull in a thousand declarations, and we touch a handful of them.
 */

export interface GPULike {
  requestAdapter(options?: {
    powerPreference?: 'low-power' | 'high-performance';
  }): Promise<GPUAdapterLike | null>;
}

export interface GPUAdapterLike {
  requestDevice(): Promise<GPUDeviceLike>;
}

export interface GPUDeviceLike {
  readonly features?: { has(name: string): boolean };
  destroy?(): void;
}

/** Does the runtime expose a WebGPU surface at all? */
export function isWebGpuSupported(gpu?: GPULike | undefined): boolean {
  if (gpu) return true;
  if (typeof navigator === 'undefined') return false;
  return typeof (navigator as Navigator & { gpu?: GPULike }).gpu === 'object';
}

export interface AcquireDeviceOptions {
  gpu?: GPULike;
  powerPreference?: 'low-power' | 'high-performance';
}

export interface DeviceAcquisition {
  device: GPUDeviceLike;
  /** True when the runtime returned a real adapter; false on fallback paths. */
  acquired: boolean;
}

/**
 * Try to acquire a WebGPU device. Returns `{ acquired: false }` when
 * the adapter is missing or the request rejects; callers should fall
 * back to a WebGL2 or 2D-canvas pipeline in that case.
 */
export async function acquireDevice(
  opts: AcquireDeviceOptions = {},
): Promise<DeviceAcquisition | null> {
  const gpu =
    opts.gpu ??
    (typeof navigator !== 'undefined'
      ? (navigator as Navigator & { gpu?: GPULike }).gpu
      : undefined);
  if (!gpu) return null;
  try {
    const adapter = await gpu.requestAdapter(
      opts.powerPreference ? { powerPreference: opts.powerPreference } : undefined,
    );
    if (!adapter) return null;
    const device = await adapter.requestDevice();
    return { device, acquired: true };
  } catch {
    return null;
  }
}
