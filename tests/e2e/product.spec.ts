import { expect, test } from './fixtures';

test('CSV → cell preview → durable Apply → stale chart → reopen → undo → offline', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('#csv-file').setInputFiles({
    name: 'quality.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('name,score\nAn,10\nBinh,\nChi,30\n'),
  });
  await page.getByRole('button', { name: 'Phân tích dữ liệu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next — Pre-processing' })).toBeEnabled();
  await page.getByRole('button', { name: 'Next — Pre-processing' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page
    .getByRole('button', { name: 'Chọn dòng 2, cột score: thiếu dữ liệu', exact: true })
    .click();
  await page.getByLabel('Giá trị thay thế', { exact: true }).fill('20');
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Áp dụng', exact: true })).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Chọn dòng 2, cột score: thiếu dữ liệu', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Chọn dòng 2, cột score: 20', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Dữ liệu đã thay đổi — cần chạy lại.', { exact: false }),
  ).toBeVisible();
  const oldCanvas = page.locator('canvas');
  await oldCanvas.scrollIntoViewIfNeeded();
  const oldBox = await oldCanvas.boundingBox();
  if (!oldBox) throw new Error('Missing chart canvas');
  await page.mouse.click(oldBox.x + oldBox.width / 2, oldBox.y + oldBox.height / 2);
  await expect(
    page.getByText('Đang xem dòng trên biểu đồ cũ, chỉ đọc.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Áp dụng', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Thoát phiên', exact: true }).click();
  await page.getByRole('button', { name: /^quality\.csv .*Mở phiên →$/ }).click();
  await expect(
    page.getByRole('button', { name: 'Chọn dòng 2, cột score: 20', exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /^quality\.csv .*Mở phiên →$/ }).click();
  await expect(
    page.getByRole('button', { name: 'Chọn dòng 2, cột score: 20', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Hoàn tác', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Chọn dòng 2, cột score: thiếu dữ liệu', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Sẵn sàng offline', { exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: /^quality\.csv .*Mở phiên →$/ }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page
    .getByRole('button', { name: 'Chọn dòng 2, cột score: thiếu dữ liệu', exact: true })
    .click();
  await page.getByLabel('Giá trị thay thế', { exact: true }).fill('25');
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Áp dụng', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Chọn dòng 2, cột score: 25', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('CSV error can be retried after changing delimiter; canceled preview changes no data', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#csv-file').setInputFiles({
    name: 'retry.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('a;b\n1,2;3\n4;\n'),
  });
  await page.locator('.import-panel select').first().selectOption(',');
  await page.getByRole('button', { name: 'Phân tích dữ liệu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next — Pre-processing' })).toBeDisabled();
  await page.locator('.import-panel select').first().selectOption(';');
  await page.getByRole('button', { name: 'Phân tích dữ liệu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next — Pre-processing' })).toBeEnabled();
  await page.getByRole('button', { name: 'Next — Pre-processing' }).click();
  await page
    .getByRole('button', { name: 'Chọn dòng 2, cột b: thiếu dữ liệu', exact: true })
    .click();
  await page.getByLabel('Giá trị thay thế', { exact: true }).fill('7');
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Áp dụng', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Hủy preview', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Áp dụng', exact: true })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Chọn dòng 2, cột b: thiếu dữ liệu', exact: true }),
  ).toBeVisible();
});

test('quota failure during Apply preserves current dataset and preview for retry', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .locator('#csv-file')
    .setInputFiles({ name: 'quota.csv', mimeType: 'text/csv', buffer: Buffer.from('a\n1\n""\n') });
  await page.getByRole('button', { name: 'Phân tích dữ liệu', exact: true }).click();
  await page.getByRole('button', { name: 'Next — Pre-processing' }).click();
  await page
    .getByRole('button', { name: 'Chọn dòng 2, cột a: thiếu dữ liệu', exact: true })
    .click();
  await page.getByLabel('Giá trị thay thế', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Áp dụng', exact: true })).toBeEnabled();
  await page.evaluate(() => {
    const original = Reflect.get(IDBObjectStore.prototype, 'add');
    IDBObjectStore.prototype.add = new Proxy(original, {
      apply(target, store: IDBObjectStore, args: [unknown, IDBValidKey?]) {
        if (store.name === 'chunks') {
          IDBObjectStore.prototype.add = target;
          throw new DOMException('Storage quota test', 'QuotaExceededError');
        }
        return Reflect.apply(target, store, args);
      },
    });
  });
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Storage quota test');
  await expect(
    page.getByRole('button', { name: 'Chọn dòng 2, cột a: thiếu dữ liệu', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Chọn dòng 2, cột a: 2', exact: true }),
  ).toBeVisible();
});
