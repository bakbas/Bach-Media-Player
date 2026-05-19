import { describe, expect, it, vi } from 'vitest';
import { createCanvasFallback } from './fallback.js';

function fakeImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128;
    data[i + 1] = 64;
    data[i + 2] = 32;
    data[i + 3] = 255;
  }
  return { width, height, data, colorSpace: 'srgb' } as ImageData;
}

function makeOutputCanvas(): { canvas: HTMLCanvasElement; calls: string[] } {
  const calls: string[] = [];
  const canvas = {
    width: 4,
    height: 2,
    getContext: vi.fn(() => ({
      drawImage: vi.fn(() => calls.push('drawImage')),
    })),
  } as unknown as HTMLCanvasElement;
  return { canvas, calls };
}

describe('createCanvasFallback', () => {
  it('passes through unchanged when no color-grade is set', () => {
    // happy-dom does not implement OffscreenCanvas 2D; fall back to <canvas>.
    Object.defineProperty(globalThis, 'OffscreenCanvas', { value: undefined, configurable: true });
    const { canvas: output, calls } = makeOutputCanvas();
    const fallback = createCanvasFallback({ output });
    const video = {
      width: 4,
      height: 2,
      getContext: vi.fn(),
    } as unknown as HTMLVideoElement;
    // Stub the read canvas factory by patching document.createElement.
    const realCreate = document.createElement.bind(document);
    const readCtx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => fakeImageData(4, 2)),
      putImageData: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => readCtx,
        } as unknown as HTMLCanvasElement;
      }
      return realCreate(tag);
    });
    fallback.render(video);
    expect(calls).toContain('drawImage');
    expect(readCtx.getImageData).not.toHaveBeenCalled();
    fallback.dispose();
  });

  it('runs color-grade through getImageData/putImageData when an effect is set', () => {
    Object.defineProperty(globalThis, 'OffscreenCanvas', { value: undefined, configurable: true });
    const { canvas: output } = makeOutputCanvas();
    const fallback = createCanvasFallback({
      output,
      colorGrade: { type: 'color-grade', exposure: 2 },
    });
    const readCtx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => fakeImageData(2, 2)),
      putImageData: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockImplementation(
      () => ({ width: 0, height: 0, getContext: () => readCtx }) as unknown as HTMLCanvasElement,
    );
    const video = { width: 2, height: 2 } as unknown as HTMLVideoElement;
    fallback.render(video);
    expect(readCtx.getImageData).toHaveBeenCalledTimes(1);
    expect(readCtx.putImageData).toHaveBeenCalledTimes(1);
    fallback.dispose();
  });

  it('setColorGrade(null) disables the pass', () => {
    Object.defineProperty(globalThis, 'OffscreenCanvas', { value: undefined, configurable: true });
    const { canvas: output } = makeOutputCanvas();
    const fallback = createCanvasFallback({
      output,
      colorGrade: { type: 'color-grade', exposure: 2 },
    });
    fallback.setColorGrade(null);
    const readCtx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(),
      putImageData: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockImplementation(
      () => ({ width: 0, height: 0, getContext: () => readCtx }) as unknown as HTMLCanvasElement,
    );
    fallback.render({ width: 1, height: 1 } as unknown as HTMLVideoElement);
    expect(readCtx.getImageData).not.toHaveBeenCalled();
    fallback.dispose();
  });

  it('throws when the output canvas has no 2D context', () => {
    const output = {
      getContext: () => null,
    } as unknown as HTMLCanvasElement;
    expect(() => createCanvasFallback({ output })).toThrow(/no 2D context/);
  });
});
