import { applyColorGrade, colorGradeUniforms } from './color-grade.js';
import type { ColorGradeEffect } from './effects.js';

/**
 * Canvas-2D fallback for environments without WebGPU. Implements
 * `color-grade` only (the most-requested pass) using the same math
 * the WGSL shader runs; other effects are dropped silently so the
 * user gets _something_ that respects the chain ordering.
 *
 * This is intentionally simple — Sprint 25b will add a WebGL2 path
 * that handles the full chain. Today's goal is just to keep Akustik
 * working on Firefox stable (which still gates WebGPU behind a flag
 * as of writing) without forcing a download of a polyfill.
 */

export interface CanvasFallback {
  /** Render one video frame into the bound output canvas. */
  render(video: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): void;
  /** Replace the active color-grade effect. Null disables the pass. */
  setColorGrade(effect: ColorGradeEffect | null): void;
  dispose(): void;
}

export interface CanvasFallbackOptions {
  output: HTMLCanvasElement;
  /** Optional initial effect. */
  colorGrade?: ColorGradeEffect | null;
}

interface RGBASource {
  width: number;
  height: number;
}

const SUPPORTS_OFFSCREEN = typeof OffscreenCanvas !== 'undefined';

function getReadContext(
  width: number,
  height: number,
): {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  canvas: HTMLCanvasElement | OffscreenCanvas;
} {
  if (SUPPORTS_OFFSCREEN) {
    const off = new OffscreenCanvas(width, height);
    const ctx = off.getContext('2d');
    if (!ctx) throw new Error('Bach gpu-fx fallback: OffscreenCanvas 2D context unavailable');
    return { ctx, canvas: off };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Bach gpu-fx fallback: 2D context unavailable');
  return { ctx, canvas };
}

export function createCanvasFallback(opts: CanvasFallbackOptions): CanvasFallback {
  let effect: ColorGradeEffect | null = opts.colorGrade ?? null;
  const outputCtx = opts.output.getContext('2d');
  if (!outputCtx) throw new Error('Bach gpu-fx fallback: output canvas has no 2D context');

  let readCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  let readCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  let scratch: Float32Array | null = null;

  return {
    setColorGrade(next) {
      effect = next;
    },

    render(video) {
      const src = video as RGBASource & CanvasImageSource;
      const w = src.width || opts.output.width;
      const h = src.height || opts.output.height;
      if (!readCanvas || readCanvas.width !== w || readCanvas.height !== h) {
        const built = getReadContext(w, h);
        readCanvas = built.canvas;
        readCtx = built.ctx;
        scratch = new Float32Array(w * h * 4);
      }
      const ctx = readCtx;
      if (!ctx) return;
      ctx.drawImage(src, 0, 0, w, h);

      if (!effect) {
        outputCtx.drawImage(
          readCanvas as CanvasImageSource,
          0,
          0,
          opts.output.width,
          opts.output.height,
        );
        return;
      }

      const data = ctx.getImageData(0, 0, w, h);
      const u = colorGradeUniforms(effect);
      const view = scratch ?? new Float32Array(w * h * 4);
      // Normalize 0..255 → 0..1, run the pure reference, write back.
      for (let i = 0; i < data.data.length; i += 1) view[i] = (data.data[i] ?? 0) / 255;
      applyColorGrade(view, u, view);
      for (let i = 0; i < data.data.length; i += 1) {
        data.data[i] = Math.round((view[i] ?? 0) * 255);
      }
      ctx.putImageData(data, 0, 0);
      outputCtx.drawImage(
        readCanvas as CanvasImageSource,
        0,
        0,
        opts.output.width,
        opts.output.height,
      );
    },

    dispose() {
      effect = null;
      readCanvas = null;
      readCtx = null;
      scratch = null;
    },
  };
}
