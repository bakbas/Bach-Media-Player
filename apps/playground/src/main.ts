import { installKeyboardShortcuts } from '@bach/a11y';
import type {
  BachCaptionsConsentElement,
  BachCaptionsElement,
  CaptionsConsentResolveEvent,
  Segment,
} from '@bach/captions-ai';
import '@bach/captions-ai/define';
import type { BachPlayerElement, applyTheme } from '@bach/core';
import '@bach/core/define';
import { createHlsEngine } from '@bach/engine-hls';
import { createNativeEngine } from '@bach/engine-native';
import type { BachGpuFxElement } from '@bach/gpu-fx';
import { type Effect, PRESETS as GPU_PRESETS, buildPipelineSpec } from '@bach/gpu-fx';
import '@bach/gpu-fx/define';
import '@bach/ui/define';
import Hls from 'hls.js';
import { PRESETS } from './themes.js';

const player = document.getElementById('player') as BachPlayerElement;
const video = player.querySelector('video') as HTMLVideoElement;

/**
 * Wire one of the available engines manually. In a full app this lives
 * inside <bach-player> itself; until that auto-wiring lands in Phase 1
 * Sprint 6 the playground does the choice explicitly so the demo runs.
 */
async function bootstrapEngine(): Promise<void> {
  const src = player.getAttribute('src') ?? '';
  const hls = createHlsEngine({
    Hls: Hls as unknown as Parameters<typeof createHlsEngine>[0]['Hls'],
  });
  const native = createNativeEngine();
  for (const engine of [hls, native]) {
    if (await engine.canHandle(src)) {
      await engine.attach(video, {});
      await engine.load(src);
      return;
    }
  }
  // eslint-disable-next-line no-console
  console.warn(`[playground] no engine matched ${src}`);
}

bootstrapEngine().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[playground] engine bootstrap failed', err);
});

installKeyboardShortcuts(player);

// ----- Theme switcher -----------------------------------------------------

const themeInput = document.getElementById('theme-input') as HTMLTextAreaElement;
const themeOutput = document.getElementById('theme-output') as HTMLPreElement;

function renderResult(label: string, result: ReturnType<typeof applyTheme>): void {
  const summary = [
    `[${label}]`,
    `applied: ${Object.keys(result.applied).length}`,
    `rejected: ${result.rejected.length}`,
  ].join(' · ');
  themeOutput.textContent = `${summary}\n${JSON.stringify(result, null, 2)}`;
}

for (const button of document.querySelectorAll<HTMLButtonElement>('button.theme')) {
  button.addEventListener('click', () => {
    const name = button.dataset.theme as keyof typeof PRESETS;
    const manifest = PRESETS[name];
    if (!manifest) return;
    themeInput.value = JSON.stringify(manifest, null, 2);
    const result = player.applyTheme(manifest);
    renderResult(name, result);
    for (const btn of document.querySelectorAll<HTMLButtonElement>('button.theme')) {
      btn.setAttribute('aria-pressed', String(btn === button));
    }
  });
}

document.getElementById('apply-theme')?.addEventListener('click', () => {
  let manifest: unknown;
  try {
    manifest = JSON.parse(themeInput.value);
  } catch (err) {
    themeOutput.textContent = `JSON parse error: ${(err as Error).message}`;
    return;
  }
  const result = player.applyTheme(manifest);
  renderResult('manual', result);
});

document.getElementById('reset-theme')?.addEventListener('click', () => {
  for (const key of Array.from(player.style)) {
    if (key.startsWith('--bach-')) player.style.removeProperty(key);
  }
  player.removeAttribute('data-layout');
  themeInput.value = '';
  themeOutput.textContent = '[reset] all --bach-* properties cleared';
  for (const btn of document.querySelectorAll<HTMLButtonElement>('button.theme')) {
    btn.setAttribute('aria-pressed', 'false');
  }
});

// ----- Headless toggle ----------------------------------------------------

const headlessToggle = document.getElementById('headless-toggle') as HTMLInputElement;
headlessToggle.addEventListener('change', () => {
  if (headlessToggle.checked) player.setAttribute('headless', '');
  else player.removeAttribute('headless');
});

// ----- AI captions demo ---------------------------------------------------

const captionsEl = player.querySelector('bach-captions') as BachCaptionsElement;
const consentEl = player.querySelector('bach-captions-consent') as BachCaptionsConsentElement;
const captionsOutput = document.getElementById('captions-output') as HTMLPreElement;

/**
 * Deterministic demo transcript. The real production binding lives in
 * `@bach/captions-ai/whisper` and consumes audio chunks from
 * `createTranscriptionController`. Wired here so E2E reviewers can verify the
 * caption rendering, the dedupe behaviour, and (most importantly) that no
 * audio bytes go out — the demo loop never touches the network.
 */
const DEMO_SCRIPT: Segment[] = [
  { start: 0, end: 2, text: 'Welcome to Bach Media Player.' },
  { start: 2.1, end: 4, text: 'Captions are generated entirely in your browser.' },
  { start: 4.1, end: 6, text: 'Your audio never leaves the device.' },
  { start: 6.1, end: 8, text: 'Disable the dialog at any time.' },
];

function renderTranscript(): void {
  const lines = captionsEl.segments.map(
    (s) => `${s.start.toFixed(2)}–${s.end.toFixed(2)}  ${s.text}`,
  );
  captionsOutput.textContent = lines.length === 0 ? '[no segments yet]' : lines.join('\n');
}

document.getElementById('captions-prompt')?.addEventListener('click', async () => {
  // Reset previous decision so the demo prompt is reachable every click.
  try {
    localStorage.removeItem('bach:captions-ai:permission');
  } catch {
    /* ignored */
  }
  await consentEl.resolve();
});

consentEl.addEventListener('bach:captions-consent', (event) => {
  const { decision } = (event as CustomEvent<CaptionsConsentResolveEvent>).detail;
  captionsOutput.textContent = `[consent] ${decision}`;
  if (decision === 'granted') {
    consentEl.setProgress(0.4);
    setTimeout(() => {
      consentEl.setProgress(1);
      consentEl.setReady();
      captionsEl.setSegments(DEMO_SCRIPT);
      renderTranscript();
    }, 350);
  }
});

document.getElementById('captions-feed')?.addEventListener('click', () => {
  captionsEl.setSegments(DEMO_SCRIPT);
  renderTranscript();
});

document.getElementById('captions-reset')?.addEventListener('click', () => {
  captionsEl.reset();
  renderTranscript();
});

renderTranscript();

// ----- GPU effects (Akustik) demo ----------------------------------------

const gpuFx = player.querySelector('bach-gpu-fx') as BachGpuFxElement;
const fxOutput = document.getElementById('fx-output') as HTMLPreElement;

function renderFxState(label: string, chain: ReadonlyArray<Effect>): void {
  if (chain.length === 0) {
    fxOutput.textContent = `[${label}] (no effects)`;
    return;
  }
  const spec = buildPipelineSpec({ effects: chain });
  const summary = spec.passes.map((p) => `  ${p.id} (${p.uniforms.length} uniforms)`).join('\n');
  fxOutput.textContent = `[${label}] ${spec.passes.length} pass(es):\n${summary}`;
}

gpuFx.addEventListener('bach:gpu-fx-chain', (event) => {
  const { chain } = (event as CustomEvent<{ chain: Effect[] }>).detail;
  renderFxState('event', chain);
});

for (const button of document.querySelectorAll<HTMLButtonElement>('button.fx')) {
  button.addEventListener('click', () => {
    const fx = button.dataset.fx as keyof typeof GPU_PRESETS | 'off';
    if (fx === 'off') {
      gpuFx.removeAttribute('preset');
      gpuFx.setChain([]);
      renderFxState('off', []);
    } else {
      gpuFx.setAttribute('preset', fx);
      gpuFx.setChain([]);
      renderFxState(fx, GPU_PRESETS[fx]);
    }
    for (const btn of document.querySelectorAll<HTMLButtonElement>('button.fx')) {
      btn.setAttribute('aria-pressed', String(btn === button));
    }
  });
}

renderFxState('idle', []);

// ----- Live state read-out ------------------------------------------------

const stateOutput = document.getElementById('state-output') as HTMLPreElement;
setInterval(() => {
  const snap = player.state.snapshot();
  stateOutput.textContent = JSON.stringify(
    {
      src: snap.src,
      currentTime: Math.round(snap.currentTime * 10) / 10,
      duration: Number.isFinite(snap.duration) ? Math.round(snap.duration * 10) / 10 : null,
      paused: snap.paused,
      muted: snap.muted,
      volume: Math.round(snap.volume * 100) / 100,
      readyState: snap.readyState,
      headless: snap.headless,
    },
    null,
    2,
  );
}, 250);
