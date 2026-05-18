import { expect, test } from '@playwright/test';

test.describe('Bach playground — Phase 1 baseline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('bach-player');
  });

  test('renders the player with all default controls in the shadow chrome', async ({ page }) => {
    const player = page.locator('bach-player');
    await expect(player).toBeVisible();

    // The default controls are slotted into the player, not inside the
    // player's own shadow root. We can locate them as light DOM children.
    await expect(player.locator('bach-play-button')).toBeVisible();
    await expect(player.locator('bach-progress')).toBeVisible();
    await expect(player.locator('bach-time')).toBeVisible();
    await expect(player.locator('bach-volume')).toBeVisible();
    await expect(player.locator('bach-fullscreen-button')).toBeVisible();
  });

  test('applies a theme preset and reports zero rejections', async ({ page }) => {
    await page.getByTestId('theme-neon').click();
    const output = await page.getByTestId('theme-output').textContent();
    expect(output).toMatch(/\[neon\]/);
    expect(output).toMatch(/rejected: 0/);
    // The accent token should be set on the host element.
    const accent = await page.evaluate(() => {
      const p = document.querySelector<HTMLElement>('bach-player');
      return p?.style.getPropertyValue('--bach-color-accent') ?? null;
    });
    expect(accent).toContain('oklch');
  });

  test('rejects a malicious manifest field and surfaces the rejection', async ({ page }) => {
    const manifest = {
      version: 1,
      cssVariables: {
        '--bach-color-accent': '<script>alert(1)</script>',
        '--bach-radius': '12px',
      },
    };
    await page.getByTestId('theme-input').fill(JSON.stringify(manifest));
    await page.getByTestId('apply-theme').click();
    const output = await page.getByTestId('theme-output').textContent();
    expect(output).toMatch(/applied: 1/);
    expect(output).toMatch(/rejected: 1/);
    expect(output).toMatch(/disallowed substring/);
  });

  test('rejects an unknown CSS variable name', async ({ page }) => {
    await page
      .getByTestId('theme-input')
      .fill(JSON.stringify({ version: 1, cssVariables: { '--evil': 'red' } }));
    await page.getByTestId('apply-theme').click();
    const output = await page.getByTestId('theme-output').textContent();
    expect(output).toMatch(/applied: 0/);
    expect(output).toMatch(/unknown css variable/);
  });

  test('reset clears every --bach-* custom property', async ({ page }) => {
    await page.getByTestId('theme-cinematic').click();
    await page.getByTestId('reset-theme').click();
    const remaining = await page.evaluate(() => {
      const p = document.querySelector<HTMLElement>('bach-player');
      if (!p) return null;
      return Array.from(p.style).filter((k) => k.startsWith('--bach-'));
    });
    expect(remaining).toEqual([]);
  });

  test('headless toggle hides the default controls slot', async ({ page }) => {
    const player = page.locator('bach-player');
    const playButton = player.locator('bach-play-button').first();
    await expect(playButton).toBeVisible();
    await page.getByTestId('headless-toggle').check();
    await expect(player).toHaveAttribute('headless', '');
    await expect(playButton).toBeHidden();
    await page.getByTestId('headless-toggle').uncheck();
    await expect(playButton).toBeVisible();
  });

  test('::part(progress-bar) is exposed for external styling', async ({ page }) => {
    const hasPart = await page.evaluate(() => {
      const progress = document.querySelector('bach-progress');
      return !!progress?.shadowRoot?.querySelector('[part="progress-bar"]');
    });
    expect(hasPart).toBe(true);
  });
});
