import { test as base, expect } from '@playwright/test';
export const test = base.extend({
  page: async ({ page, context }, use) => {
    const username = `e2e_${crypto.randomUUID().slice(0, 12)}`,
      password = 'correct horse battery staple';
    const options = { headers: { origin: 'http://localhost:4173' }, data: { username, password } };
    expect(
      (await context.request.post('http://localhost:3001/auth/register', options)).status(),
    ).toBe(201);
    expect((await context.request.post('http://localhost:3001/auth/login', options)).status()).toBe(
      200,
    );
    await use(page);
  },
});
export { expect };
