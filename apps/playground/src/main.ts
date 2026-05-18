import type { BachPlayerElement, applyTheme } from '@bach/core';
import '@bach/core/define';
import '@bach/ui/define';
import { installKeyboardShortcuts } from '@bach/a11y';
import { createHlsEngine } from '@bach/engine-hls';
import { createNativeEngine } from '@bach/engine-native';
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
