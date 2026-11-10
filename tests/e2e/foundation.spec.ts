import { expect, test } from './fixtures';

test('production shell has no fake data, account or persistence success', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bắt đầu từ dữ liệu của bạn.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chưa có dữ liệu' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next — Pre-processing' })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Chưa có dữ liệu' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('production API never claims database readiness', async ({ request }) => {
  const response = await request.get('http://localhost:3001/health');
  expect(response.ok()).toBe(true);
  const body: unknown = await response.json();
  expect(body).toEqual({ status: 'ok', database: 'connected', syncReady: true });
});
