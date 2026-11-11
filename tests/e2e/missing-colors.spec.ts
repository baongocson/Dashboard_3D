import { test, expect } from '@playwright/test';
// Synthetic CSV used only in an isolated test context.
test('Missing Values changes only point colors, sharing coordinates and axes with Cleaning', async ({
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
  await page
    .locator('#csv-file')
    .setInputFiles({
      name: 'MISSING_COLOR_TEST_ONLY.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'label,x,y,z,a,b\nminimum,0,10,100,,\nmidpoint,5,20,200,ok,\nmaximum,10,30,300,ok,ok\nmissing_x,,20,200,,\n',
      ),
    });
  await page.getByRole('button', { name: 'Analyze Data', exact: true }).click();
  await page.getByRole('button', { name: 'Preprocessing', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cleaning 3D', exact: true })).toBeVisible();
  const scene = page.locator('.scene-canvas'),
    select = page.getByLabel('Select Row', { exact: true });
  const original: string[] = [];
  for (const id of ['row-1', 'row-2', 'row-3']) {
    await select.selectOption(id);
    original.push((await scene.getAttribute('data-active-position')) ?? '');
    await expect(scene).toHaveAttribute('data-active-color', '#38bdf8');
  }
  await page.getByRole('button', { name: 'Missing Values', exact: true }).click();
  await expect(scene).toHaveAttribute('data-scene-ready', 'true');
  const colors = ['rgb(234, 165, 117)', 'rgb(244, 190, 144)', '#38bdf8'];
  for (let i = 0; i < 3; i++) {
    await select.selectOption(`row-${String(i + 1)}`);
    await expect(scene).toHaveAttribute('data-active-position', original[i] ?? '');
    await expect(scene).toHaveAttribute('data-active-color', colors[i] ?? '');
  }
  await expect(page.getByText('Showing 3/4 rows', { exact: false })).toBeVisible();
  await select.selectOption('row-4');
  await expect(scene).toHaveAttribute('data-active-position', 'null');
  await expect(page.getByLabel('x: missing value', { exact: true })).toBeChecked();
  await page.getByLabel('Axis X', { exact: true }).selectOption({ label: 'z' });
  await page.getByLabel('Axis Y', { exact: true }).selectOption({ label: 'y' });
  await page.getByLabel('Axis Z', { exact: true }).selectOption({ label: 'z' });
  await expect(scene).toHaveAttribute('data-active-position', '[0,0,0]');
  await expect(scene).toHaveAttribute('data-active-color', 'rgb(224, 140, 91)');
  await page.getByLabel('Axis Projections', { exact: true }).check();
  await expect(scene).toHaveAttribute('data-projections', 'true');
  await page.screenshot({ path: 'outputs/missing-colors-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'outputs/missing-colors-mobile.png', fullPage: true });
});
