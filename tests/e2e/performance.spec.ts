import { test, expect } from './fixtures';

test('CSV near 20 MB: full-data import, local persistence, measured UI gaps', async ({
  page,
  context,
}, info) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await expect(page.getByText('Sẵn sàng offline', { exact: true })).toBeVisible();
  await context.setOffline(true);
  const row = `${'x'.repeat(86)},1\n`,
    count = Math.floor(19_900_000 / Buffer.byteLength(row));
  const buffer = Buffer.from(`label,value\n${row.repeat(count)}`);
  await page
    .locator('#csv-file')
    .setInputFiles({ name: 'near-limit.csv', mimeType: 'text/csv', buffer });
  await page.evaluate(() => {
    performance.mark('import-start');
    let previous = performance.now();
    const frame = () => {
      const now = performance.now();
      performance.measure('ui-gap', { start: previous, end: now });
      previous = now;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  await page.getByRole('button', { name: 'Phân tích dữ liệu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next — Pre-processing' })).toBeEnabled({
    timeout: 100_000,
  });
  await expect(page.locator('.metric').filter({ hasText: 'Số dòng' }).locator('strong')).toHaveText(
    count.toLocaleString('vi-VN'),
  );
  await expect(page.getByText('Local: Đã lưu trên máy')).toBeVisible();
  const timing = await page.evaluate(() => ({
    totalMs: performance.now() - (performance.getEntriesByName('import-start')[0]?.startTime ?? 0),
    maxUiGapMs: performance
      .getEntriesByName('ui-gap')
      .reduce((maximum, entry) => Math.max(maximum, entry.duration), 0),
  }));
  const result = { bytes: buffer.length, rows: count, ...timing };
  console.log('IMPORT_BENCHMARK', JSON.stringify(result));
  await info.attach('near-20mb-import.json', {
    body: JSON.stringify(result, null, 2),
    contentType: 'application/json',
  });
});
