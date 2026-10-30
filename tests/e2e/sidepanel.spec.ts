import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { expect, seedStorage, test } from './fixtures';
import { anyLocale } from './locale';

// Regex that matches a message in any shipped locale (side panel follows its own
// language setting, which defaults to the browser UI language).
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const anyText = (key: string) => new RegExp(anyLocale(key).filter(Boolean).map(escape).join('|'));
const exactText = (key: string) => new RegExp(`^(${anyLocale(key).filter(Boolean).map(escape).join('|')})$`);

// The real side panel cannot be opened from automation, so the same page is
// opened as a tab in the same window; activating the test tab afterwards makes
// the background report it as the active page, just like with the side panel.
const openPanel = async ({ context, extensionId, page, site, serviceWorker }: {
  context: import('@playwright/test').BrowserContext;
  serviceWorker: import('@playwright/test').Worker;
  extensionId: string;
  page: Page;
  site: { origin: string; siteKey: string };
}) => {
  await seedStorage(serviceWorker, site.siteKey);
  await page.goto(`${site.origin}/app/index.html`);
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await page.bringToFront();
  await serviceWorker.evaluate(async (origin) => {
    const [tab] = await chrome!.tabs.query({ url: `${origin}/*` });
    await chrome!.tabs.update(tab.id!, { active: true });
  }, site.origin);
  await expect(panel.getByText(site.siteKey).first()).toBeVisible();
  return panel;
};

test('flow runs from the side panel without a page notice', async ({ context, serviceWorker, extensionId, page, site }) => {
  const panel = await openPanel({ context, serviceWorker, extensionId, page, site });
  const errors: string[] = [];
  panel.on('pageerror', (error) => errors.push(String(error)));
  await panel.getByRole('button', { name: anyText('sidepanel_tab_flows') }).first().click();
  await panel.getByRole('heading', { name: 'OK flow' }).click();
  await panel.getByRole('button', { name: exactText('sidepanel_action_run') }).click();
  await expect(panel.getByText(anyText('sidepanel_flow_runner_state_succeeded')).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#name')).toHaveValue('hello');
  expect(await page.evaluate(() => Boolean(document.getElementById('ladybird-page-notice')))).toBe(false);
  expect(errors).toEqual([]);
});

test('new If/Else step is empty and Save warns first', async ({ context, serviceWorker, extensionId, page, site }) => {
  const panel = await openPanel({ context, serviceWorker, extensionId, page, site });
  await panel.getByRole('button', { name: anyText('sidepanel_tab_flows') }).first().click();
  await panel.getByRole('button', { name: anyText('sidepanel_flows_create') }).first().click();
  await panel.getByText(anyText('sidepanel_steps_add')).first().click();
  await panel.getByText(anyText('sidepanel_step_if_else_label')).last().click();
  await expect(panel.getByPlaceholder('.status')).toHaveValue('');
  await expect(panel.getByPlaceholder('Ready')).toHaveValue('');

  await panel.getByRole('button', { name: exactText('sidepanel_action_save') }).last().click();
  await expect(panel.getByText(anyText('sidepanel_flows_config_warnings_title'))).toBeVisible();
  const saveAnyway = panel.getByRole('button', { name: anyText('sidepanel_action_save_anyway') });
  await expect(saveAnyway).toHaveCount(1);
  await saveAnyway.click();
  await expect
    .poll(() =>
      serviceWorker.evaluate(
        async (key) => ((await chrome!.storage.local.get('ladybird_sites')) as { ladybird_sites: any }).ladybird_sites.sites[key].flows.length,
        site.siteKey,
      ),
    )
    .toBe(3);
});

test('import asks for confirmation and handles bad files', async ({ context, serviceWorker, extensionId, page, site }, testInfo) => {
  const panel = await openPanel({ context, serviceWorker, extensionId, page, site });
  await panel.getByRole('button', { name: anyText('sidepanel_action_settings') }).first().click();
  const importFile = testInfo.outputPath('import.json');
  fs.mkdirSync(path.dirname(importFile), { recursive: true });
  fs.writeFileSync(
    importFile,
    JSON.stringify({
      version: '1.0.3',
      sites: { 'example.org': { elements: [], hidden: [], flows: [{ id: 'imp-1', name: 'Imported', description: '', steps: [], updatedAt: 1 }] } },
      settings: { autoHideAdsEnabled: true },
    }),
  );
  const fileInput = panel.locator('input[type=file]').first();
  await fileInput.setInputFiles(importFile);
  const dialog = panel.getByRole('dialog').or(panel.getByRole('alertdialog')).last();
  await expect(dialog).toContainText(anyText('sidepanel_settings_import_confirm_ads_on'));
  await dialog.getByRole('button', { name: anyText('sidepanel_action_cancel') }).click();
  const imported = await serviceWorker.evaluate(
    async () => Boolean(((await chrome!.storage.local.get('ladybird_sites')) as { ladybird_sites: any }).ladybird_sites.sites['example.org']),
  );
  expect(imported).toBe(false);

  const badFile = testInfo.outputPath('bad.json');
  fs.writeFileSync(badFile, 'not json');
  await fileInput.setInputFiles(badFile);
  await expect(panel.getByText(anyText('sidepanel_settings_import_error_not_json'))).toBeVisible();
});
