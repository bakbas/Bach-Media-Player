import { type BachCssVariable, CSS_VARIABLE_TOKENS } from './theming.js';

/**
 * Theme manifest v0 — the JSON shape `applyTheme(manifest)` accepts.
 *
 * Designed as the foundation for the Phase 5 conducting sandbox: the parser
 * is the security boundary, not the renderer. Any unknown key, mistyped
 * value, or suspicious substring is rejected before it touches the DOM.
 *
 * v1 will add typography presets, layout enum extensions, and animation
 * gates. The contract guarantees v1 manifests with `version: 1` remain
 * valid; new keys must be additive.
 */
export interface ThemeManifest {
  version: 1;
  cssVariables?: Partial<Record<BachCssVariable, string>>;
  layout?: ThemeLayout;
}

export type ThemeLayout = 'default' | 'compact' | 'cinematic';

const LAYOUT_VALUES = new Set<ThemeLayout>(['default', 'compact', 'cinematic']);

const COLOR_REGEX =
  /^(?:#[0-9a-fA-F]{3,8}|rgba?\([\d.,\s%/-]+\)|oklch\([\d.,\s%/-]+\)|color-mix\([\w%.,\s()/-]+\)|currentcolor|transparent)$/i;
const LENGTH_REGEX = /^-?\d+(?:\.\d+)?(px|rem|em|%|vh|vw)?$/;
const FONT_FAMILY_REGEX = /^[\w\s\-,'"]+$/;

const VALIDATORS: Record<string, RegExp | undefined> = {
  color: COLOR_REGEX,
  length: LENGTH_REGEX,
  'font-family': FONT_FAMILY_REGEX,
};

/**
 * Substrings that have no legitimate place inside a Bach theme value.
 * Catches `url(...)`, IE-era CSS expressions, inline JS, data URIs, and
 * any attempt to escape the value position into HTML.
 */
const DANGER = /[<>{};]|url\s*\(|expression\s*\(|javascript:|data:|@import|@charset/i;

export interface ThemeRejection {
  key: string;
  value: unknown;
  reason: string;
}

export interface ApplyThemeResult {
  applied: Partial<Record<BachCssVariable, string>>;
  rejected: ThemeRejection[];
  layout: ThemeLayout | null;
}

/**
 * Apply a theme manifest to `target`. Returns a breakdown of which keys
 * landed and which were rejected (with reasons), so the conducting director
 * panel — or any caller — can show a precise diagnostic.
 *
 * The function never throws on bad input: it returns an empty `applied` map
 * with one or more entries in `rejected`. Callers should treat that as
 * "manifest dropped silently" and surface a single high-level error if
 * needed.
 */
export function applyTheme(target: HTMLElement, manifest: unknown): ApplyThemeResult {
  const rejected: ThemeRejection[] = [];
  const applied: Partial<Record<BachCssVariable, string>> = {};

  if (!manifest || typeof manifest !== 'object') {
    rejected.push({ key: '__manifest', value: manifest, reason: 'manifest must be a JSON object' });
    return { applied, rejected, layout: null };
  }
  const m = manifest as Record<string, unknown>;

  if (m.version !== 1) {
    rejected.push({ key: 'version', value: m.version, reason: 'expected version: 1' });
    return { applied, rejected, layout: null };
  }

  if (m.cssVariables !== undefined) {
    if (typeof m.cssVariables !== 'object' || m.cssVariables === null) {
      rejected.push({
        key: 'cssVariables',
        value: m.cssVariables,
        reason: 'must be an object',
      });
    } else {
      for (const [key, value] of Object.entries(m.cssVariables as Record<string, unknown>)) {
        const token = CSS_VARIABLE_TOKENS[key as BachCssVariable];
        if (!token) {
          rejected.push({
            key,
            value,
            reason: 'unknown css variable (not in the public token set)',
          });
          continue;
        }
        if (typeof value !== 'string') {
          rejected.push({ key, value, reason: 'value must be a string' });
          continue;
        }
        if (value.length > 256) {
          rejected.push({ key, value, reason: 'value exceeds 256 characters' });
          continue;
        }
        if (DANGER.test(value)) {
          rejected.push({ key, value, reason: 'value contains a disallowed substring' });
          continue;
        }
        const validator = VALIDATORS[token.type];
        if (!validator || !validator.test(value)) {
          rejected.push({ key, value, reason: `value does not match the ${token.type} pattern` });
          continue;
        }
        target.style.setProperty(key, value);
        applied[key as BachCssVariable] = value;
      }
    }
  }

  let layout: ThemeLayout | null = null;
  if (m.layout !== undefined) {
    if (typeof m.layout === 'string' && LAYOUT_VALUES.has(m.layout as ThemeLayout)) {
      target.setAttribute('data-layout', m.layout);
      layout = m.layout as ThemeLayout;
    } else {
      rejected.push({
        key: 'layout',
        value: m.layout,
        reason: 'must be one of: default, compact, cinematic',
      });
    }
  }

  // Any keys we did not recognise at the top level are rejected explicitly,
  // so future versions of the SDK never silently accept fields a malicious
  // manifest might rely on.
  for (const key of Object.keys(m)) {
    if (key !== 'version' && key !== 'cssVariables' && key !== 'layout') {
      rejected.push({ key, value: m[key], reason: 'unknown manifest field' });
    }
  }

  return { applied, rejected, layout };
}
