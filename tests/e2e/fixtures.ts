import { test as base, chromium, type BrowserContext, type Page, type Worker } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
import type { AddressInfo } from 'node:net';

const EXTENSION_DIR = path.resolve(HERE, '../../.output/chrome-mv3');

// One small test site: an anchor for injected elements, an input for flows,
// buttons that change the URL with history.pushState (SPA navigation), and a
// target with a tall page below it so tooltips can be checked while scrolling.
const TEST_PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Ladybird test page</title>
<style>body{font-family:sans-serif;margin:0}#top{padding:20px}#target-btn{margin:200px 0 0 300px}.spacer{height:2000px}</style></head>
<body><div id="top"><div id="anchor">anchor:</div>
<input id="name" placeholder="name">
<button id="go-b" onclick="history.pushState({},'','/app/b')">go b</button>
<button id="go-a" onclick="history.pushState({},'','/app/index.html')">go a</button></div>
<button id="target-btn">Target</button><div class="spacer"></div></body></html>`;

type Fixtures = {
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
  page: Page;
};
type WorkerFixtures = { site: { origin: string; siteKey: string } };

export const test = base.extend<Fixtures, WorkerFixtures>({
  site: [
    async ({}, use) => {
      const server = http.createServer((_req, res) => {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(TEST_PAGE);
      });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const { port } = server.address() as AddressInfo;
      await use({ origin: `http://127.0.0.1:${port}`, siteKey: `127.0.0.1:${port}` });
      server.close();
    },
    { scope: 'worker' },
  ],
  context: async ({}, use) => {
    if (!fs.existsSync(path.join(EXTENSION_DIR, 'manifest.json'))) {
      throw new Error(`Build the extension first: ${EXTENSION_DIR} is missing (npm run build).`);
    }
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ladybird-e2e-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: !process.env.HEADED,
      args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`, '--lang=en-US'],
      locale: 'en-US',
      viewport: { width: 1100, height: 760 },
    });
    await use(context);
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  },
  serviceWorker: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) {
      worker = await context.waitForEvent('serviceworker');
    }
    // The worker can be registered before chrome.* bindings are ready.
    await expectEventually(() => worker.evaluate(() => Boolean((globalThis as { chrome?: typeof chrome }).chrome?.storage?.local)));
    await use(worker);
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
  page: async ({ context }, use) => {
    const page = await context.newPage();
    await use(page);
  },
});

export { expect } from '@playwright/test';

const expectEventually = async (check: () => Promise<boolean>, attempts = 40) => {
  for (let i = 0; i < attempts; i += 1) {
    if (await check()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Condition not met in time');
};

const now = Date.now();
const field = (id: string, value: string, type = 'text') => ({ id, label: id, type, value });

const element = (
  siteKey: string,
  id: string,
  text: string,
  type: 'button' | 'link' | 'tooltip' | 'area',
  extra: { scope?: 'page' | 'site'; pageKey?: string; selector?: string; behavior?: Record<string, unknown> } = {},
) => ({
  id,
  text,
  scope: extra.scope ?? 'site',
  context: { siteKey, pageKey: extra.pageKey ?? null, frame: null },
  placement: { mode: 'dom', selector: extra.selector ?? '#anchor', position: 'append', relativeTo: {} },
  style: { inline: {}, customCss: '' },
  behavior: { type, ...(extra.behavior ?? {}) },
  createdAt: now,
  updatedAt: now,
});

// Seed data shared by the specs.
export const buildSeed = (siteKey: string) => ({
  sites: {
    [siteKey]: {
      elements: [
        element(siteKey, 'el-tip', 'Tip text', 'tooltip', { selector: '#target-btn', behavior: { tooltipPosition: 'top' } }),
        element(siteKey, 'el-page-a', 'PageA', 'button', { scope: 'page', pageKey: `${siteKey}/app/index.html` }),
        element(siteKey, 'el-page-b', 'PageB', 'button', { scope: 'page', pageKey: `${siteKey}/app/b` }),
        element(siteKey, 'el-run-ok', 'RunOK', 'button', { behavior: { actionFlowId: 'flow-ok' } }),
        element(siteKey, 'el-run-fail', 'RunFail', 'button', { behavior: { actionFlowId: 'flow-fail' } }),
        element(siteKey, 'el-run-missing', 'RunMissing', 'button', { behavior: { actionFlowId: 'flow-deleted' } }),
      ],
      flows: [
        {
          id: 'flow-ok',
          name: 'OK flow',
          description: '',
          scope: 'site',
          siteKey,
          pageKey: null,
          updatedAt: now,
          steps: [
            { id: 's1', type: 'input', title: 'Input', summary: '', fields: [field('selector', '#name'), field('value', 'hello')] },
            {
              id: 's2',
              type: 'assert',
              title: 'Assert',
              summary: '',
              fields: [field('selector', '#name'), field('operator', 'equals', 'select'), field('expected', 'hello')],
            },
          ],
        },
        {
          id: 'flow-fail',
          name: 'Fail flow',
          description: '',
          scope: 'site',
          siteKey,
          pageKey: null,
          updatedAt: now,
          steps: [
            {
              id: 'f1',
              type: 'assert',
              title: 'Assert',
              summary: '',
              fields: [field('selector', '#name'), field('operator', 'equals', 'select'), field('expected', 'nope')],
            },
          ],
        },
      ],
      hidden: [],
    },
  },
});

export const seedStorage = (worker: Worker, siteKey: string) =>
  worker.evaluate((data) => chrome!.storage.local.set({ ladybird_sites: data }), buildSeed(siteKey));
