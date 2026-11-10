import { expect, test } from './fixtures';

// Phat UI: production tests. No CSV Worker is connected yet.
// These tests verify the visible UI and never pretend to import a CSV.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('Collection: no dataset means Next and import are disabled', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Chưa có dữ liệu' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next — Pre-processing' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Phân tích dữ liệu' })).toBeDisabled();
});

test('Collection: a valid CSV imports through Worker and persists locally', async ({ page }) => {
  await page.locator('input[type="file"]').setInputFiles({
    name: 'students.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('name,age\nAn,20\nBinh,21\n'),
  });
  await expect(page.getByText('students.csv', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Phân tích dữ liệu' })).toBeEnabled();
  await page.getByRole('button', { name: 'Phân tích dữ liệu' }).click();
  await expect(page.getByRole('button', { name: 'Next — Pre-processing' })).toBeEnabled();
  await expect(page.getByText('Local: Đã lưu trên máy')).toBeVisible();
});

test('Collection: reject non-CSV filenames', async ({ page }) => {
  await page.locator('input[type="file"]').setInputFiles({
    name: 'students.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('name,age\nAn,20\n'),
  });
  await expect(page.getByRole('alert')).toContainText('Chỉ nhận tệp có đuôi .csv.');
  await expect(page.getByRole('button', { name: 'Phân tích dữ liệu' })).toBeDisabled();
});

test('Collection: reject empty CSV files', async ({ page }) => {
  await page.locator('input[type="file"]').setInputFiles({
    name: 'empty.csv',
    mimeType: 'text/csv',
    buffer: Buffer.alloc(0),
  });
  await expect(page.getByRole('alert')).toContainText('Tệp đang trống.');
  await expect(page.getByRole('button', { name: 'Phân tích dữ liệu' })).toBeDisabled();
});

test('Collection: reject CSV files larger than 20 MB', async ({ page }) => {
  await page.locator('input[type="file"]').setInputFiles({
    name: 'too-large.csv',
    mimeType: 'text/csv',
    buffer: Buffer.alloc(20_000_001),
  });
  await expect(page.getByRole('alert')).toContainText('Tệp vượt giới hạn');
  await expect(page.getByRole('button', { name: 'Phân tích dữ liệu' })).toBeDisabled();
});

test('Collection: import options are editable before processing', async ({ page }) => {
  const selects = page.locator('.import-panel select');
  await selects.nth(0).selectOption(';');
  await expect(selects.nth(0)).toHaveValue(';');
  await selects.nth(1).selectOption('generated');
  await expect(selects.nth(1)).toHaveValue('generated');
  await page.getByRole('checkbox', { name: 'NA' }).check();
  await expect(page.getByRole('checkbox', { name: 'NA' })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Phân tích dữ liệu' })).toBeDisabled();
});
