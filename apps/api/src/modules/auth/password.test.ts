import { describe, expect, it } from 'vitest';
import { DEFAULT_SCRYPT_PARAMS, hashPassword, verifyPassword } from './password.js';

const FAST = { N: 2 ** 10, r: 8, p: 1 };

describe('password hashing', () => {
  it('verifies the exact password only, with a random salt per hash', async () => {
    const password = '  Mật khẩu 😀 dài đủ  ';
    const first = await hashPassword(password, FAST);
    const second = await hashPassword(password, FAST);
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword(password.trim(), first)).toBe(false);
    expect(await verifyPassword(password.toUpperCase(), first)).toBe(false);
    // NFC vs NFD forms of the same text are different passwords (no normalization).
    expect(await verifyPassword(password.normalize('NFD'), first)).toBe(false);
  });

  it('rejects malformed or tampered hashes instead of throwing', async () => {
    const hash = await hashPassword('correct horse battery', FAST);
    expect(await verifyPassword('correct horse battery', 'plain-text')).toBe(false);
    const tampered = hash.slice(0, -4) + (hash.endsWith('AAA=') ? 'BBB=' : 'AAA=');
    expect(await verifyPassword('correct horse battery', tampered)).toBe(false);
  });

  it('records the cost so the OWASP default can be verified later', async () => {
    expect(DEFAULT_SCRYPT_PARAMS).toEqual({ N: 131072, r: 8, p: 1 });
    const hash = await hashPassword('correct horse battery');
    expect(hash).toMatch(/^scrypt\$v1\$N=131072,r=8,p=1\$/);
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
  });
});
