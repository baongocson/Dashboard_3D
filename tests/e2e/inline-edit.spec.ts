import { test, expect } from '@playwright/test';
// Explicit synthetic fixture. The production UI continues to use the opened project's data.
test('Collection summaries and inline Pre_pro edit preserve source and reopen a new version', async ({
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
    name: 'inline-fixture.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'App,Age,Income,Score,Enabled\nAlpha,10,100,1,true\nBeta,20,200,2,false\nGamma,30,300,3,true\nMissing,,400,100,false\n',
    ),
  });
  await page.getByRole('button', { name: 'Analyze Data', exact: true }).click();
  await expect(page.locator('.missing-bars')).toContainText('25%');
  await page.getByLabel('Boxplot Column', { exact: true }).selectOption({ label: 'Score' });
  await expect(page.getByLabel('Boxplot', { exact: true })).toContainText('Outliers: 1');
  await page.getByRole('button', { name: 'Preprocessing', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cleaning 3D', exact: true })).toBeVisible();
  const select = page.getByLabel('Select Row', { exact: true });
  const rowId = await select.locator('option').nth(2).getAttribute('value');
  if (!rowId) throw new Error('Missing fixture row');
  await select.selectOption(rowId);
  await expect(page.getByLabel('Edit App', { exact: true })).toHaveValue('Beta');
  const age = page.getByLabel('Edit Age', { exact: true });
  await age.fill('NaN');
  await expect(page.getByRole('button', { name: 'Save Changes', exact: true })).toBeDisabled();
  await age.press('Escape');
  await expect(age).toHaveValue('20');
  const before = await page.locator('.scene-canvas').getAttribute('data-active-position');
  await age.fill('25');
  await age.press('Enter');
  await expect(page.locator('.scene-canvas')).not.toHaveAttribute(
    'data-active-position',
    before ?? '',
  );
  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-active-row', rowId);
  await age.fill('26');
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Unsaved Changes' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep Editing', exact: true }).click();
  await expect(age).toHaveValue('26');
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await page.getByRole('button', { name: 'Discard and Continue', exact: true }).click();
  await expect(page.locator('.missing-bars')).toContainText('25%');
  await page.getByRole('button', { name: 'Preprocessing', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cleaning 3D', exact: true })).toBeVisible();
  await select.selectOption(rowId);
  await expect(age).toHaveValue('25');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Close Session', exact: true }).click();
  await page.getByRole('button', { name: /^inline-fixture.csv .*Open Session/ }).click();
  await select.selectOption(rowId);
  await expect(age).toHaveValue('25');
});
