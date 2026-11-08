import { expect, test } from '@playwright/test';

// UI interaction tests using the explicitly DEV-ONLY demo fixture.
// These do not assert real Worker execution or durable local persistence.
test.beforeEach(async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(page.getByRole('button', { name: 'Next — Pre-processing' })).toBeEnabled();
  await page.getByRole('button', { name: 'Next — Pre-processing' }).click();
  await expect(page.getByRole('heading', { name: 'Xử lý Missing' })).toBeVisible();
});

async function selectMissingAge(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /Chọn dòng 3, cột Tuổi: thiếu dữ liệu/ }).click();
  await expect(page.getByText('row-003', { exact: true })).toBeVisible();
}

test('Pre-processing: selecting a missing cell identifies the correct row and type', async ({ page }) => {
  await selectMissingAge(page);
  await expect(page.locator('.selected-details')).toContainText('Tuổi');
  await expect(page.locator('.selected-details')).toContainText('number');
  await expect(page.locator('.selected-details')).toContainText('null');
  await expect(page.locator('#fill-value')).toBeEnabled();
});

test('Pre-processing: preview displays proposed change without mutating dataset', async ({ page }) => {
  await selectMissingAge(page);
  await page.locator('#fill-value').fill('22');
  await page.getByRole('button', { name: 'Xem trước' }).click();
  await expect(page.locator('.preview-result')).toBeVisible();
  await expect(page.locator('.preview-result')).toContainText('22');
  await expect(page.getByRole('button', { name: /Chọn dòng 3, cột Tuổi: thiếu dữ liệu/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Áp dụng' })).toBeDisabled();
});

test('Pre-processing: cancel clears preview and keeps the source cell missing', async ({ page }) => {
  await selectMissingAge(page);
  await page.locator('#fill-value').fill('22');
  await page.getByRole('button', { name: 'Xem trước' }).click();
  await expect(page.locator('.preview-result')).toBeVisible();
  await page.getByRole('button', { name: 'Hủy preview' }).click();
  await expect(page.locator('.preview-result')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Chọn dòng 3, cột Tuổi: thiếu dữ liệu/ })).toBeVisible();
});

test('Pre-processing: editing a value invalidates the prior preview', async ({ page }) => {
  await selectMissingAge(page);
  await page.locator('#fill-value').fill('22');
  await page.getByRole('button', { name: 'Xem trước' }).click();
  await expect(page.locator('.preview-result')).toBeVisible();
  await page.locator('#fill-value').fill('23');
  await expect(page.locator('.preview-result')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Hủy preview' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Áp dụng' })).toBeDisabled();
});

test('Pre-processing: empty numeric input cannot produce a preview', async ({ page }) => {
  await selectMissingAge(page);
  await page.locator('#fill-value').fill('');
  await expect(page.getByRole('button', { name: 'Xem trước' })).toBeDisabled();
  await expect(page.locator('.preview-result')).toHaveCount(0);
});

test('Pre-processing: switching selection clears the old preview', async ({ page }) => {
  await selectMissingAge(page);
  await page.locator('#fill-value').fill('22');
  await page.getByRole('button', { name: 'Xem trước' }).click();
  await expect(page.locator('.preview-result')).toBeVisible();
  await page.getByRole('button', { name: /Chọn dòng 4, cột Điểm: thiếu dữ liệu/ }).click();
  await expect(page.locator('.preview-result')).toHaveCount(0);
  await expect(page.locator('#fill-value')).toHaveValue('');
  await expect(page.locator('.selected-details')).toContainText('row-004');
  await expect(page.getByRole('button', { name: 'Áp dụng' })).toBeDisabled();
});
