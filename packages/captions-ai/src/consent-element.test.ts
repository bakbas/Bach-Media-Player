import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BachCaptionsConsentElement } from './consent-element.js';
import { writePermission } from './permission.js';

beforeAll(() => {
  if (!customElements.get('bach-captions-consent')) {
    customElements.define('bach-captions-consent', BachCaptionsConsentElement);
  }
});

beforeEach(() => {
  try {
    localStorage.removeItem('bach:captions-ai:permission');
  } catch {
    // ignore in environments without localStorage
  }
  document.body.innerHTML = '';
});

function makeConsent(model: 'tiny' | 'base' | 'small' = 'tiny'): BachCaptionsConsentElement {
  const el = document.createElement('bach-captions-consent') as BachCaptionsConsentElement;
  el.setAttribute('model', model);
  document.body.appendChild(el);
  return el;
}

describe('<bach-captions-consent>', () => {
  it('renders the model size in the body copy', () => {
    const el = makeConsent('tiny');
    const size = el.shadowRoot?.querySelector('.size-value');
    expect(size?.textContent).toBe('39');
  });

  it('updates the size when the model attribute changes', () => {
    const el = makeConsent('tiny');
    el.setAttribute('model', 'base');
    expect(el.shadowRoot?.querySelector('.size-value')?.textContent).toBe('74');
  });

  it('starts in idle and opens when resolve() returns unknown', async () => {
    const el = makeConsent();
    expect(el.getAttribute('state')).toBe('idle');
    const result = await el.resolve();
    expect(result.state).toBe('unknown');
    expect(el.hasAttribute('open')).toBe(true);
  });

  it('skips the dialog when permission is already granted', async () => {
    writePermission('granted');
    const el = makeConsent();
    const result = await el.resolve();
    expect(result.state).toBe('granted');
    expect(el.hasAttribute('open')).toBe(false);
    expect(el.getAttribute('state')).toBe('ready');
  });

  it('reports cached when the probe finds the model', async () => {
    const el = makeConsent();
    el.setCacheProbe({ cached: async () => true });
    const result = await el.resolve();
    expect(result.state).toBe('cached');
    expect(el.getAttribute('state')).toBe('ready');
  });

  it('persists the decision and dispatches an event when accepted', async () => {
    const el = makeConsent();
    await el.resolve();
    const listener = vi.fn();
    el.addEventListener('bach:captions-consent', listener);
    el.shadowRoot?.querySelector<HTMLButtonElement>('button.primary')?.click();
    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0]?.[0];
    expect(event.detail.decision).toBe('granted');
    expect(localStorage.getItem('bach:captions-ai:permission')).toBe('granted');
    expect(el.hasAttribute('open')).toBe(false);
  });

  it('persists denial when the user clicks Not now', async () => {
    const el = makeConsent();
    await el.resolve();
    el.shadowRoot?.querySelector<HTMLButtonElement>('button.secondary')?.click();
    expect(localStorage.getItem('bach:captions-ai:permission')).toBe('denied');
  });

  it('setProgress switches to loading and updates the progress bar', () => {
    const el = makeConsent();
    el.setProgress(0.25);
    expect(el.getAttribute('state')).toBe('loading');
    const bar = el.shadowRoot?.querySelector<HTMLProgressElement>('progress');
    expect(bar?.value).toBe(25);
    const text = el.shadowRoot?.querySelector('.progress-text');
    expect(text?.textContent).toBe('25%');
  });

  it('setReady marks the dialog ready and hides it', () => {
    const el = makeConsent();
    el.setAttribute('open', '');
    el.setReady();
    expect(el.getAttribute('state')).toBe('ready');
    expect(el.hasAttribute('open')).toBe(false);
  });

  it('setReady does nothing after the user declined', async () => {
    const el = makeConsent();
    await el.resolve();
    el.shadowRoot?.querySelector<HTMLButtonElement>('button.secondary')?.click();
    el.setReady();
    expect(el.getAttribute('state')).not.toBe('ready');
  });
});
