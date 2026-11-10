import { setServers } from 'node:dns';
import { MongoClient } from 'mongodb';
import { authSessionResponseSchema } from '@dashboard/contracts';
import { test, expect } from '@playwright/test';

test('production UI → real Atlas → second browser restores processed dataset', async ({
  page,
  context,
  browser,
}) => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Run with backend .env containing MONGODB_URI');
  if (process.env.MONGODB_DNS_SERVERS) setServers(process.env.MONGODB_DNS_SERVERS.split(','));
  const username = `atlas_${crypto.randomUUID().slice(0, 12)}`,
    password = 'production atlas test password';
  const options = { headers: { origin: 'http://localhost:4173' }, data: { username, password } };
  let ownerId: string | undefined;
  try {
    expect(
      (await context.request.post('http://localhost:3001/auth/register', options)).status(),
    ).toBe(201);
    const login = await context.request.post('http://localhost:3001/auth/login', options);
    expect(login.status()).toBe(200);
    ownerId = authSessionResponseSchema.parse(await login.json()).user.id;
    await page.goto('/');
    await page.locator('#csv-file').setInputFiles({
      name: 'atlas-roundtrip.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('name,score\nAn,10\nBinh,\nChi,30\n'),
    });
    await page.getByRole('button', { name: 'Phân tích dữ liệu', exact: true }).click();
    await page.getByRole('button', { name: 'Next — Pre-processing' }).click();
    await page
      .getByRole('button', { name: 'Chọn dòng 2, cột score: thiếu dữ liệu', exact: true })
      .click();
    await page.getByLabel('Giá trị thay thế', { exact: true }).fill('20');
    await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
    await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Chọn dòng 2, cột score: 20', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Đồng bộ ngay (gồm project local)', exact: true })
      .click();
    await expect(page.getByText('Đồng bộ: synced', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    const second = await browser.newContext();
    try {
      expect(
        (await second.request.post('http://localhost:3001/auth/login', options)).status(),
      ).toBe(200);
      const other = await second.newPage();
      await other.goto('/');
      await other.getByRole('button', { name: 'Danh sách project server', exact: true }).click();
      await other.getByRole('button', { name: /atlas-roundtrip\.csv .*Tải \/ Mở phiên/ }).click();
      await expect(
        other.getByRole('button', { name: 'Chọn dòng 2, cột score: 20', exact: true }),
      ).toBeVisible();
      await expect(other.getByRole('button', { name: 'Hoàn tác', exact: true })).toBeEnabled();
      await expect(
        other.getByText('Dữ liệu đã thay đổi — cần chạy lại.', { exact: false }),
      ).toBeVisible();
      await other.screenshot({ path: 'test-results/atlas-roundtrip.png', fullPage: true });
    } finally {
      await second.close();
    }
  } finally {
    // Delete only this run's uniquely named user and its owned records, never a database.
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15_000 });
    try {
      await client.connect();
      const database = client.db(process.env.MONGODB_DB_NAME ?? 'dashboard_dev');
      const user = await database
        .collection<{ _id: string; usernameNormalized: string }>('users')
        .findOne({ usernameNormalized: username });
      const ownId = ownerId ?? user?._id;
      if (ownId) {
        await Promise.all(
          ['projects', 'datasetChunks', 'syncOperations'].map((name) =>
            database.collection(name).deleteMany({ ownerId: ownId }),
          ),
        );
        await database.collection('auth_sessions').deleteMany({ userId: ownId });
      }
      await database.collection('users').deleteMany({ usernameNormalized: username });
    } finally {
      await client.close();
    }
  }
});
