import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  EXPORT_JSON_VERSION,
  buildExportPayload,
  mergeSitesData,
  parseImportPayload,
} from '../../shared/importExport';

const fixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../docs/testing/fixtures/flow-step-test-import-2026-05-28.json'), 'utf8'),
);

describe('parseImportPayload', () => {
  it('reads the 2026-05-28 flow fixture', () => {
    const parsed = parseImportPayload(fixture);
    expect(parsed.summary).toMatchObject({ siteCount: 1, elementCount: 0, flowCount: 10, hiddenCount: 0 });
    expect(parsed.summary.warnings).toEqual([]);
  });

  it('round-trips through export without losing items', () => {
    const parsed = parseImportPayload(fixture);
    const exported = buildExportPayload(parsed.sites, { settings: { autoHideAdsEnabled: true } });
    expect(exported.version).toBe(EXPORT_JSON_VERSION);
    const reparsed = parseImportPayload(JSON.parse(JSON.stringify(exported)));
    expect(reparsed.summary.flowCount).toBe(10);
    expect(reparsed.settings).toEqual({ autoHideAdsEnabled: true });
    const flowIds = (sites: typeof parsed.sites) =>
      Object.values(sites).flatMap((site) => site.flows.map((flow) => flow.id));
    expect(flowIds(reparsed.sites)).toEqual(flowIds(parsed.sites));
  });

  it('rejects unknown shapes', () => {
    expect(() => parseImportPayload('nope')).toThrow();
    expect(() => parseImportPayload({ foo: 1 })).toThrow();
  });

  it('drops prototype-polluting keys', () => {
    const raw = JSON.parse(
      '{"version":"1.0.3","sites":{"example.com":{"elements":[],"flows":[],"hidden":[],"__proto__":{"polluted":true}}}}',
    );
    parseImportPayload(raw);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('mergeSitesData', () => {
  const flow = (id: string, name: string) => ({ id, name, description: '', steps: [], updatedAt: 1 });
  it('replaces items with the same id and keeps the rest', () => {
    const current = {
      'a.com': { elements: [], hidden: [], flows: [flow('f1', 'old'), flow('f2', 'keep')] },
      'b.com': { elements: [], hidden: [], flows: [flow('f9', 'other site')] },
    };
    const incoming = {
      'a.com': { elements: [], hidden: [], flows: [flow('f1', 'new'), flow('f3', 'added')] },
    };
    const merged = mergeSitesData(current, incoming);
    const names = merged['a.com']!.flows.map((f) => `${f.id}:${f.name}`).sort();
    expect(names).toEqual(['f1:new', 'f2:keep', 'f3:added']);
    expect(merged['b.com']).toEqual(current['b.com']);
  });
});
