import { z } from 'zod';
import { authSessionResponseSchema } from '@dashboard/contracts';
import { test, expect } from './fixtures';

test('header confirmation and per-column Missing plans; encoding undo restores structure', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#csv-file').setInputFiles({
    name: 'headers.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('a,a,b\n1,,x\n,3,y\n'),
  });
  await page.getByRole('button', { name: 'Phân tích dữ liệu', exact: true }).click();
  await expect(page.getByLabel('Tên cột đề xuất')).toHaveValue('a\na_2\nb');
  await page.getByRole('button', { name: 'Xác nhận tên cột', exact: true }).click();
  await page.getByRole('button', { name: 'Phân tích dữ liệu', exact: true }).click();
  await page.getByRole('button', { name: 'Next — Pre-processing' }).click();
  await page.getByLabel('Phương pháp', { exact: true }).selectOption('missing-batch');
  await page.getByLabel('Missing cột a', { exact: true }).selectOption('mean');
  await page.getByLabel('Missing cột a_2', { exact: true }).selectOption('median');
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
  await expect(page.getByText('2 ô thay đổi', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Chọn dòng 2, cột a: 1', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Chọn dòng 1, cột a_2: 3', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Encoding', exact: true }).click();
  await page.getByLabel('Phạm vi', { exact: true }).selectOption('all');
  await page.getByLabel('Cột xử lý', { exact: true }).selectOption('column-3');
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click();
  await expect(page.getByText('Cột đầu ra:', { exact: false })).toContainText('b__x, b__y');
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'b__x', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Hoàn tác', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'b', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'b__x', exact: true })).toHaveCount(0);
});

test('real raycast selects a row; table selection, filter and camera survive reopening', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#csv-file').setInputFiles({
    name: 'camera.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('name,score\nAn,10\nBinh,\nChi,30\n'),
  });
  await page.getByRole('button', { name: 'Phân tích dữ liệu', exact: true }).click();
  await page.getByRole('button', { name: 'Next — Pre-processing' }).click();
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await canvas.scrollIntoViewIfNeeded();
  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-scene-ready', 'true');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Missing canvas');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('.chart-tooltip')).toContainText('row-2');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(
    page.getByRole('button', { name: 'Chọn dòng 2, cột score: thiếu dữ liệu', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.4, { steps: 8 });
  await page.mouse.up();
  await page.mouse.wheel(0, -100);
  await page.getByLabel('Cột lọc bảng', { exact: true }).selectOption('column-1');
  await page.getByLabel('Giá trị lọc bảng', { exact: true }).fill('Binh');
  await page.getByRole('button', { name: 'Lưu phiên', exact: true }).click();
  await expect(page.getByText('Local: Đã lưu trên máy')).toBeVisible();
  const cameraSchema = z.object({
    position: z.tuple([z.number(), z.number(), z.number()]),
    target: z.tuple([z.number(), z.number(), z.number()]),
    zoom: z.number(),
  });
  const movedCamera = cameraSchema.parse(
    JSON.parse((await page.locator('.scene-canvas').getAttribute('data-camera')) ?? 'null'),
  );
  await page.getByRole('button', { name: 'Thoát phiên', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: /^camera\.csv .*Mở phiên →$/ }).click();
  await expect(page.locator('.scene-canvas')).toHaveAttribute('data-scene-ready', 'true');
  const restoredCamera = cameraSchema.parse(
    JSON.parse((await page.locator('.scene-canvas').getAttribute('data-camera')) ?? 'null'),
  );
  restoredCamera.position.forEach((value, index) => {
    expect(value).toBeCloseTo(movedCamera.position[index] ?? 0, 6);
  });
  expect(restoredCamera.zoom).toBe(movedCamera.zoom);
  await expect(page.getByLabel('Giá trị lọc bảng', { exact: true })).toHaveValue('Binh');
  await expect(
    page.getByRole('button', { name: /Chọn dòng 1, cột score: thiếu dữ liệu/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'test-results/integrated-workspace.png', fullPage: true });
});

test('lost commit ACK retries safely and project opens in a second browser context', async ({
  page,
  context,
  browser,
}) => {
  let lost = false;
  await page.route('**/api/sync/*/commit', async (route) => {
    if (!lost) {
      lost = true;
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await page.goto('/');
  await page.locator('#csv-file').setInputFiles({
    name: 'cloud.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('a,b\n1,hello\n2,world\n'),
  });
  await page.getByRole('button', { name: 'Phân tích dữ liệu', exact: true }).click();
  await expect(page.getByText('Đồng bộ: failed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Đồng bộ ngay (gồm project local)', exact: true }).click();
  await expect(page.getByText('Đồng bộ: synced', { exact: true })).toBeVisible();
  const account = authSessionResponseSchema.parse(
    await (
      await context.request.get('http://localhost:3001/auth/session', {
        headers: { 'x-session-activity': 'background' },
      })
    ).json(),
  );
  const second = await browser.newContext();
  try {
    expect(
      (
        await second.request.post('http://localhost:3001/auth/login', {
          headers: { origin: 'http://localhost:4173' },
          data: { username: account.user.username, password: 'correct horse battery staple' },
        })
      ).status(),
    ).toBe(200);
    const other = await second.newPage();
    await other.goto('/');
    await other.getByRole('button', { name: 'Danh sách project server', exact: true }).click();
    await other.getByRole('button', { name: /cloud\.csv .*Tải \/ Mở phiên/ }).click();
    await expect(other.getByRole('cell', { name: 'hello', exact: true })).toBeVisible();
    await expect(other.getByRole('button', { name: 'Next — Pre-processing' })).toBeEnabled();
  } finally {
    await second.close();
  }
});

test('signup UI returns to login; anonymous users cannot import', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Đăng nhập để bắt đầu.' })).toBeVisible();
    await expect(page.locator('#csv-file')).toHaveCount(0);
    await page.getByRole('button', { name: 'Chuyển sang đăng ký' }).click();
    await page
      .getByLabel('Tên đăng nhập', { exact: true })
      .fill(`ui_${crypto.randomUUID().slice(0, 12)}`);
    await page.getByLabel('Mật khẩu', { exact: true }).fill('a proper long password');
    await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
    await expect(
      page.getByText('Đăng ký thành công. Hãy đăng nhập.', { exact: true }),
    ).toBeVisible();
    await page.getByLabel('Mật khẩu', { exact: true }).fill('a proper long password');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page.locator('#csv-file')).toBeVisible();
  } finally {
    await context.close();
  }
});

test('offline pending blocks logout; syncing first clears only local account data', async ({
  page,
  context,
}) => {
  const auth = authSessionResponseSchema.parse(
    await (await context.request.get('http://localhost:3001/auth/session')).json(),
  );
  await page.goto('/');
  await expect(page.getByText('Sẵn sàng offline', { exact: true })).toBeVisible();
  await context.setOffline(true);
  await page
    .locator('#csv-file')
    .setInputFiles({ name: 'logout.csv', mimeType: 'text/csv', buffer: Buffer.from('a\n1\n2\n') });
  await page.getByRole('button', { name: 'Phân tích dữ liệu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next — Pre-processing' })).toBeEnabled();
  await page.locator('.account-panel > summary').click();
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.getByRole('button', { name: 'Đồng bộ trước rồi đăng xuất', exact: true }).click();
  await expect(
    page.getByText('Offline và có dữ liệu chưa đồng bộ: chưa thể đăng xuất.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next — Pre-processing' })).toBeEnabled();
  await page.getByRole('dialog').getByRole('button', { name: 'Hủy', exact: true }).click();
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Đồng bộ ngay (gồm project local)', exact: true }).click();
  await expect(page.getByText('Đồng bộ: synced', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.getByRole('button', { name: 'Đồng bộ trước rồi đăng xuất', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Đăng nhập để bắt đầu.' })).toBeVisible();
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill(auth.user.username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.locator('#csv-file')).toBeVisible();
  await expect(page.locator('.project-list .project-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Danh sách project server', exact: true }).click();
  await expect(page.getByRole('button', { name: /logout\.csv .*Tải \/ Mở phiên/ })).toBeVisible();
});

test('canceling a CSV job retains the last fully saved project', async ({ page }) => {
  await page.goto('/');
  await page
    .locator('#csv-file')
    .setInputFiles({ name: 'keep.csv', mimeType: 'text/csv', buffer: Buffer.from('a\nkeep\n') });
  await page.getByRole('button', { name: 'Phân tích dữ liệu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next — Pre-processing' })).toBeEnabled();
  await page.locator('#csv-file').setInputFiles({
    name: 'cancel.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`a,b\n${'long-text,1\n'.repeat(500_000)}`),
  });
  await page.getByRole('button', { name: 'Phân tích dữ liệu', exact: true }).click();
  await page.getByRole('button', { name: 'Hủy xử lý', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'keep', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next — Pre-processing' })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('button', { name: /^keep\.csv .*Mở phiên →$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^cancel\.csv .*Mở phiên →$/ })).toHaveCount(0);
});
