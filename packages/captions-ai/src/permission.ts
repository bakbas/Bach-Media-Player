import { type ModelCacheProbe, WHISPER_MODELS, type WhisperModelKey } from './whisper.js';

export type PermissionState = 'unknown' | 'cached' | 'granted' | 'denied';

const STORAGE_KEY = 'bach:captions-ai:permission';

interface PermissionStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Read the stored permission decision (last user choice). Returns `'unknown'`
 * when no decision has been made yet — the caller should prompt.
 */
export function readPermission(
  store: PermissionStore = localStorage,
): 'granted' | 'denied' | 'unknown' {
  try {
    const v = store.getItem(STORAGE_KEY);
    if (v === 'granted' || v === 'denied') return v;
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export function writePermission(
  decision: 'granted' | 'denied',
  store: PermissionStore = localStorage,
): void {
  try {
    store.setItem(STORAGE_KEY, decision);
  } catch {
    // Storage write blocked (private mode, quota): silently no-op. The
    // caller will re-prompt on the next session, which is fine for an
    // opt-in feature.
  }
}

export interface PermissionResolution {
  state: PermissionState;
  model: WhisperModelKey;
  /** Size in megabytes, rounded up — for use in the consent prompt. */
  sizeMb: number;
}

/**
 * Decide what state the captions feature is in. Order:
 *
 *   1. If the model is already in the Cache API, return `cached` —
 *      caller may load without prompting.
 *   2. If the user previously made a decision, honour it.
 *   3. Otherwise return `unknown` and let the caller surface a UI.
 */
export async function resolvePermission(
  model: WhisperModelKey,
  probe?: ModelCacheProbe,
  store?: PermissionStore,
): Promise<PermissionResolution> {
  const info = WHISPER_MODELS[model];
  const sizeMb = Math.ceil(info.sizeBytes / (1024 * 1024));
  if (probe && (await probe.cached(info.id))) {
    return { state: 'cached', model, sizeMb };
  }
  const decision = readPermission(store);
  return { state: decision, model, sizeMb };
}
