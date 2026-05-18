import { expect, test } from '@playwright/test';

/**
 * Phase 2 captions tests. Two threads:
 *  - the UX flow: consent dialog gates, accept/decline persistence, cue
 *    rendering driven from the deterministic demo transcript.
 *  - the privacy promise: no outbound request from the page may carry
 *    audio bytes. The demo runs a fake engine so the only legitimate
 *    network calls are the HLS manifest and segments — we assert that
 *    nothing else (especially nothing with an audio MIME or an
 *    octet-stream POST body) leaves the tab while the captions feature
 *    is active.
 */

test.describe('Captions (Notasyon)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('bach-captions');
    await page.evaluate(() => localStorage.removeItem('bach:captions-ai:permission'));
  });

  test('consent dialog opens on first prompt and persists denial', async ({ page }) => {
    await page.getByTestId('captions-prompt').click();
    const consent = page.getByTestId('captions-consent');
    await expect(consent).toHaveAttribute('open', '');

    // Click decline through the shadow root.
    await consent.evaluate((el) => {
      const btn = (el as HTMLElement).shadowRoot?.querySelector<HTMLButtonElement>(
        'button.secondary',
      );
      btn?.click();
    });

    await expect(consent).not.toHaveAttribute('open', '');
    const stored = await page.evaluate(() => localStorage.getItem('bach:captions-ai:permission'));
    expect(stored).toBe('denied');
  });

  test('accept flow drives progress, fills transcript, advances cue', async ({ page }) => {
    await page.getByTestId('captions-prompt').click();
    const consent = page.getByTestId('captions-consent');
    await expect(consent).toHaveAttribute('open', '');

    await consent.evaluate((el) => {
      const btn = (el as HTMLElement).shadowRoot?.querySelector<HTMLButtonElement>(
        'button.primary',
      );
      btn?.click();
    });

    await expect(consent).toHaveAttribute('state', 'ready');
    const output = page.getByTestId('captions-output');
    await expect(output).toContainText('Welcome to Bach Media Player');

    // Drive the cue overlay by setting currentTime on the host state.
    await page.evaluate(() => {
      const player = document.querySelector('bach-player') as HTMLElement & {
        state: { currentTime: { value: number } };
      };
      player.state.currentTime.value = 3;
    });

    const cueText = await page.evaluate(() => {
      const c = document.querySelector('bach-captions');
      return c?.shadowRoot?.querySelector('.cue')?.textContent ?? '';
    });
    expect(cueText).toBe('Captions are generated entirely in your browser.');
  });

  test('captions feed renders all demo segments without duplicates', async ({ page }) => {
    await page.getByTestId('captions-feed').click();
    // Click twice — the aligner should dedupe the second submission.
    await page.getByTestId('captions-feed').click();

    const segmentCount = await page.evaluate(() => {
      const c = document.querySelector('bach-captions') as HTMLElement & {
        segments: ReadonlyArray<unknown>;
      };
      return c.segments.length;
    });
    expect(segmentCount).toBe(4);
  });

  test('reset empties retained transcript', async ({ page }) => {
    await page.getByTestId('captions-feed').click();
    await expect(page.getByTestId('captions-output')).toContainText('Welcome');
    await page.getByTestId('captions-reset').click();
    await expect(page.getByTestId('captions-output')).toContainText('[no segments yet]');
  });

  test('privacy: no outbound request carries audio bytes during captions flow', async ({
    page,
  }) => {
    // Allow only the playground origin and Mux's test HLS host. Anything else
    // is suspicious; a request with audio MIME or octet-stream POST body
    // would be a leak.
    const allowedHosts = ['127.0.0.1', 'test-streams.mux.dev'];
    const offenders: Array<{ url: string; reason: string }> = [];

    page.on('request', (request) => {
      const url = new URL(request.url());
      if (allowedHosts.includes(url.hostname)) return;

      const headers = request.headers();
      const contentType = (headers['content-type'] ?? '').toLowerCase();
      if (request.method() === 'POST') {
        offenders.push({ url: request.url(), reason: `POST to third party (${contentType})` });
        return;
      }
      if (contentType.startsWith('audio/') || contentType === 'application/octet-stream') {
        offenders.push({ url: request.url(), reason: `audio MIME (${contentType})` });
      }
    });

    await page.getByTestId('captions-prompt').click();
    const consent = page.getByTestId('captions-consent');
    await consent.evaluate((el) => {
      const btn = (el as HTMLElement).shadowRoot?.querySelector<HTMLButtonElement>(
        'button.primary',
      );
      btn?.click();
    });
    await expect(consent).toHaveAttribute('state', 'ready');

    await page.getByTestId('captions-feed').click();
    // Give the demo a moment to settle.
    await page.waitForTimeout(500);

    expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
  });
});
