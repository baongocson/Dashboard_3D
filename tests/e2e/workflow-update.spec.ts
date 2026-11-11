import { test, expect, type Page } from '@playwright/test';
import type { Dataset } from '@dashboard/contracts';
// Synthetic CSV and isolated browser storage used solely for this regression test.
async function stored(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('dashboard-3d-local');
      r.onsuccess = () => {
        resolve(r.result);
      };
      r.onerror = () => {
        reject(r.error ?? new Error('IndexedDB error'));
      };
    });
    async function all<T>(store: string): Promise<T[]> {
      return new Promise((resolve, reject) => {
        const r = db.transaction(store).objectStore(store).getAll();
        r.onsuccess = () => {
          resolve(r.result as T[]);
        };
        r.onerror = () => {
          reject(r.error ?? new Error('IndexedDB error'));
        };
      });
    }
    const versions = await all<{ id: string; manifestId: string }>('versions');
    const sessions = await all<{
      currentVersionId: string;
      confirmedConfiguration: { workspace: string };
    }>('sessions');
    const chunks = await all<{ manifestId: string; ordinal: number; data: ArrayBuffer }>('chunks');
    const histories = await all<{ method: string }>('histories');
    const session = sessions[0];
    if (!session) throw new Error('Missing fixture session');
    const workspace = JSON.parse(session.confirmedConfiguration.workspace) as {
      sourceVersionId: string;
    };
    function load(id: string) {
      const version = versions.find((v) => v.id === id);
      if (!version) throw new Error('Missing fixture version');
      const parts = chunks
        .filter((c) => c.manifestId === version.manifestId)
        .sort((a, b) => a.ordinal - b.ordinal);
      const size = parts.reduce((s, c) => s + c.data.byteLength, 0);
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const p of parts) {
        bytes.set(new Uint8Array(p.data), offset);
        offset += p.data.byteLength;
      }
      return JSON.parse(new TextDecoder().decode(bytes)) as Dataset;
    }
    const result = {
      dataset: load(session.currentVersionId),
      source: load(workspace.sourceVersionId),
      versionCount: versions.length,
      history: histories.map((h) => h.method),
    };
    db.close();
    return result;
  });
}
test('CSV defaults, source exploration, automatic dedup, bulk cleaning, replacement and ordinal', async ({
  page,
  context,
  baseURL,
}) => {
  if (!baseURL) throw new Error('Missing test baseURL');
  const target = process.env.E2E_INLINE_API;
  const api = target ?? `${baseURL}/api`;
  const auth = {
    headers: { origin: baseURL },
    data: {
      username: `inline_${crypto.randomUUID().slice(0, 12)}`,
      password: 'test-only-inline-long-password',
    },
  };
  expect((await context.request.post(`${api}/auth/register`, auth)).status()).toBe(201);
  expect((await context.request.post(`${api}/auth/login`, auth)).status()).toBe(200);
  if (target)
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const response = await route.fetch({
        url: target + url.pathname.replace(/^\/api/, '') + url.search,
      });
      await route.fulfill({ response });
    });

  await page.goto('/');
  await page.locator('#csv-file').setInputFiles({
    name: 'WORKFLOW_TEST_ONLY.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'name,group,age,income,enabled,missingA,missingB\nA,low,10,100,false,null,N/A\nA,low,10,100,false,null,N/A\n B ,mid,0,200,true, ,null\nC,high,30,300,false,o,0\nD,low,,400,true,0,N/A\n',
    ),
  });
  await page.getByRole('button', { name: 'Analyze Data', exact: true }).click();
  await page.locator('.feature-explorer').waitFor();
  await expect(page.locator('.token-fieldset')).toHaveCount(0);
  await expect(page.locator('.feature-explorer')).toContainText('Boolean');
  await page.getByLabel('Value Counts Column', { exact: true }).selectOption({ label: 'group' });
  await expect(page.locator('.value-counts tbody tr').first()).toContainText('low');
  await expect(page.locator('.value-counts tbody tr').first()).toContainText('3');
  await expect(page.locator('.heatmap button')).toHaveCount(9);
  const imported = await stored(page);
  expect(imported.source.rows).toHaveLength(5);
  expect(imported.source.rows[0]?.cells['column-5']).toBe(false);
  expect(imported.source.rows[0]?.cells['column-6']).toBeNull();
  expect(imported.source.rows[2]?.cells['column-3']).toBe(0);
  expect(imported.source.rows[3]?.cells['column-6']).toBe('o');
  await page.getByRole('button', { name: 'Preprocessing', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cleaning 3D', exact: true })).toBeVisible();
  let state = await stored(page);
  expect(state.dataset.rows.map((r) => r.id)).toEqual(['row-1', 'row-3', 'row-4', 'row-5']);
  expect(state.source).toEqual(imported.source);
  expect(state.history).toContain('deduplicate');
  await expect(page.getByLabel('Method', { exact: true })).toHaveValue('cleaning-batch');
  await expect(page.getByLabel('Chart Column', { exact: true })).toHaveCount(0);
  await page.locator('.column-clean-plan > summary').getByText('name', { exact: true }).click();
  await page.getByLabel('Trim Whitespace name', { exact: true }).check();
  await page.getByLabel('Replacement name', { exact: true }).check();
  await page.getByLabel('name Find Value 1', { exact: true }).fill('B');
  await page.getByLabel('name Replacement Value 1', { exact: true }).fill('Beta');
  await page.locator('.column-clean-plan > summary').getByText('group', { exact: true }).click();
  await page.getByLabel('Replacement group', { exact: true }).check();
  const groupPlan = page
    .locator('.column-clean-plan')
    .filter({ has: page.locator('summary').getByText('group', { exact: true }) });
  for (const [i, from, to] of [
    [1, 'low', 'L'],
    [2, 'mid', 'M'],
    [3, 'high', 'H'],
  ] as const) {
    if (i > 1)
      await groupPlan.getByRole('button', { name: 'Add Replacement', exact: true }).click();
    await page.getByLabel(`group Find Value ${String(i)}`, { exact: true }).fill(from);
    await page.getByLabel(`group Replacement Value ${String(i)}`, { exact: true }).fill(to);
  }
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByLabel('Preview Result')).toContainText('5 cells changed');
  async function apply() {
    const before = (await stored(page)).dataset.versionId;
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect.poll(async () => (await stored(page)).dataset.versionId).not.toBe(before);
  }
  await apply();
  state = await stored(page);
  expect(state.dataset.rows[1]?.cells['column-1']).toBe('Beta');
  expect(state.dataset.rows.map((r) => r.cells['column-2'])).toEqual(['L', 'M', 'H', 'L']);
  await page.getByLabel('Method', { exact: true }).selectOption('replace');
  await page.getByLabel('Target Columns', { exact: true }).selectOption({ label: 'group' });
  await page.getByLabel('Replacement Find Value 1', { exact: true }).fill('L');
  await page.getByLabel('Replacement Replacement Value 1', { exact: true }).fill('M');
  await page.getByRole('button', { name: 'Add Replacement', exact: true }).click();
  await page.getByLabel('Replacement Find Value 2', { exact: true }).fill('M');
  await page.getByLabel('Replacement Replacement Value 2', { exact: true }).fill('L');
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByLabel('Preview Result')).toContainText('3 cells changed');
  await apply();
  expect((await stored(page)).dataset.rows.map((r) => r.cells['column-2'])).toEqual([
    'M',
    'L',
    'H',
    'M',
  ]);
  await page.getByRole('button', { name: 'Encoding', exact: true }).click();
  await page.getByLabel('Method', { exact: true }).selectOption('ordinal');
  await page.getByLabel('Target Columns', { exact: true }).selectOption({ label: 'age' });
  await expect(page.getByRole('alert')).toContainText('not a categorical column');
  await page.getByLabel('Target Columns', { exact: true }).selectOption({ label: 'group' });
  for (const [value, rank] of Object.entries({ M: '2', L: '1', H: '0' }))
    await page.getByLabel(`Rank group: ${value}`, { exact: true }).fill(rank);
  await page.getByLabel('Keep Original Columns', { exact: true }).check();
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByLabel('Preview Result')).toContainText('group_ordinal');
  await apply();
  state = await stored(page);
  const ordinal = state.dataset.columns.find((c) => c.name === 'group_ordinal');
  if (!ordinal) throw new Error('Missing ordinal output');
  expect(state.dataset.rows.map((r) => r.cells[ordinal.id])).toEqual([2, 1, 0, 2]);
  await page.getByRole('button', { name: 'Missing Values', exact: true }).click();
  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-scene-ready', 'true');
  await expect(page.getByText('Showing 1/4 rows', { exact: false })).toBeVisible();
  await expect(page.locator('.missing-color-legend')).toContainText('More Missing Values');
  expect(
    await page
      .getByLabel('Method', { exact: true })
      .locator('option')
      .evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value)),
  ).not.toEqual(expect.arrayContaining(['forward', 'backward', 'drop-missing']));
  await page.getByRole('button', { name: 'Scaling', exact: true }).click();
  expect(
    await page
      .getByLabel('Method', { exact: true })
      .locator('option')
      .evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value)),
  ).toEqual(['minmax', 'standard']);
  await page.getByRole('button', { name: 'Transformation', exact: true }).click();
  expect(
    await page
      .getByLabel('Method', { exact: true })
      .locator('option')
      .evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value)),
  ).toEqual(['log1p', 'sqrt']);
  await expect(page.getByLabel('Chart Column', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await page.locator('.feature-explorer').waitFor();
  expect((await stored(page)).source).toEqual(imported.source);
  await page.screenshot({ path: 'outputs/workflow-collection.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'outputs/workflow-mobile.png', fullPage: true });
  const count = (await stored(page)).versionCount;
  await page.getByRole('button', { name: 'Preprocessing', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cleaning 3D', exact: true })).toBeVisible();
  expect((await stored(page)).versionCount).toBe(count);
  await page.getByRole('button', { name: 'Close Session', exact: true }).click();
  await page.getByRole('button', { name: /^WORKFLOW_TEST_ONLY.csv .*Open Session/ }).click();
  await expect(page.getByRole('heading', { name: 'Cleaning 3D', exact: true })).toBeVisible();
  state = await stored(page);
  expect(state.dataset.rows).toHaveLength(4);
  expect(state.source).toEqual(imported.source);
});
