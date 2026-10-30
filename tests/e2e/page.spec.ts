import type { Page } from '@playwright/test';
import { expect, seedStorage, test } from './fixtures';
import { matchesAnyLocale } from './locale';

const injected = (page: Page, text: string) => page.locator('[data-ladybird-element]', { hasText: text });

const notice = (page: Page) =>
  page.evaluate(() => {
    const box = document.getElementById('ladybird-page-notice')?.shadowRoot?.querySelector<HTMLElement>('.box');
    return { text: box?.textContent ?? '', tone: box?.dataset.tone ?? '' };
  });

test.beforeEach(async ({ serviceWorker, site, page }) => {
  await seedStorage(serviceWorker, site.siteKey);
  await page.goto(`${site.origin}/app/index.html`);
  await expect(injected(page, 'RunOK')).toHaveCount(1);
});

test('loads the built extension', async ({ serviceWorker }) => {
  const manifest = await serviceWorker.evaluate(() => chrome!.runtime.getManifest());
  expect(manifest.manifest_version).toBe(3);
});

test('page-scoped elements follow SPA navigation', async ({ page }) => {
  await expect(injected(page, 'PageA')).toHaveCount(1);
  await expect(injected(page, 'PageB')).toHaveCount(0);
  await page.click('#go-b');
  await expect(injected(page, 'PageB')).toHaveCount(1);
  await expect(injected(page, 'PageA')).toHaveCount(0);
  await page.click('#go-a');
  await expect(injected(page, 'PageA')).toHaveCount(1);
});

test('tooltip sits centered above its target and follows scrolling', async ({ page }) => {
  const geometry = () =>
    page.evaluate(() => {
      const target = document.querySelector('#target-btn')!.getBoundingClientRect();
      const host = [...document.querySelectorAll('[data-ladybird-element]')].find((node) =>
        node.shadowRoot?.textContent?.includes('Tip text'),
      )!;
      const tip = host.shadowRoot!.querySelector('.ladybird-tooltip')!.getBoundingClientRect();
      return {
        gap: target.top - tip.bottom,
        centerOffset: Math.abs(tip.left + tip.width / 2 - (target.left + target.width / 2)),
      };
    });
  let g = await geometry();
  expect(g.gap).toBeGreaterThanOrEqual(0);
  expect(g.centerOffset).toBeLessThan(2);
  await page.mouse.wheel(0, 120);
  await expect.poll(async () => (await geometry()).gap).toBeGreaterThanOrEqual(0);
  g = await geometry();
  expect(g.gap).toBeLessThan(12);
});

test('page button shows a success notice and runs the flow', async ({ page }) => {
  await injected(page, 'RunOK').locator('button').click();
  await expect.poll(async () => (await notice(page)).tone, { timeout: 15_000 }).toBe('success');
  expect(matchesAnyLocale((await notice(page)).text, 'page_run_succeeded', { name: 'OK flow' })).toBe(true);
  await expect(page.locator('#name')).toHaveValue('hello');
});

test('JS transform on an input value runs in the flow', async ({ page }) => {
  await injected(page, 'RunTransform').locator('button').click();
  await expect.poll(async () => (await notice(page)).tone, { timeout: 15_000 }).toBe('success');
  await expect(page.locator('#name')).toHaveValue('HELLO!');
});

test('page button shows a translated failure reason', async ({ page }) => {
  await injected(page, 'RunFail').locator('button').click();
  await expect.poll(async () => (await notice(page)).tone, { timeout: 30_000 }).toBe('error');
  const { text } = await notice(page);
  expect(matchesAnyLocale(text, 'page_run_failed', { name: 'Fail flow' })).toBe(true);
  expect(matchesAnyLocale(text, 'runner_error_assertion_failed')).toBe(true);
});

test('button bound to a deleted flow explains the problem', async ({ page }) => {
  await injected(page, 'RunMissing').locator('button').click();
  await expect.poll(async () => (await notice(page)).tone).toBe('error');
  expect(matchesAnyLocale((await notice(page)).text, 'page_run_flow_missing')).toBe(true);
});

test('element picker shows a hint and closes on Esc', async ({ page, serviceWorker, site }) => {
  await serviceWorker.evaluate(async (origin) => {
    const [tab] = await chrome!.tabs.query({ url: `${origin}/*` });
    await chrome!.tabs.sendMessage(tab!.id!, { type: 'START_PICKER', data: { accept: 'selector' } }, { frameId: 0 });
  }, site.origin);
  const overlay = page.locator('[data-picker-overlay]');
  await expect(overlay).toHaveCount(1);
  expect(matchesAnyLocale(await overlay.innerText(), 'page_picker_hint_select')).toBe(true);
  await page.keyboard.press('Escape');
  await expect(overlay).toHaveCount(0);
});
