import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing with Node's built-in scrypt (no extra native dependency, no custom crypto).
 * Default cost follows the OWASP Password Storage Cheat Sheet: N=2^17, r=8, p=1 (~128 MiB).
 * Parameters are stored in the hash so they can be raised later without breaking old hashes.
 * Format: scrypt$v1$N=<n>,r=<r>,p=<p>$<salt base64>$<key base64>
 */
export interface ScryptParams {
  N: number;
  r: number;
  p: number;
}
export const DEFAULT_SCRYPT_PARAMS: ScryptParams = { N: 2 ** 17, r: 8, p: 1 };
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

function derive(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // The password is used exactly as typed: never trimmed, case-folded or Unicode-normalized.
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      { ...params, maxmem: 128 * params.N * params.r * 2 },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}

export async function hashPassword(
  password: string,
  params: ScryptParams = DEFAULT_SCRYPT_PARAMS,
): Promise<string> {
  if (/[\uD800-\uDFFF]/u.test(password)) throw new Error('Password contains invalid Unicode');
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, params);
  return `scrypt$v1$N=${String(params.N)},r=${String(params.r)},p=${String(params.p)}$${salt.toString('base64')}$${key.toString('base64')}`;
}

function parse(hash: string): { params: ScryptParams; salt: Buffer; key: Buffer } | null {
  const match = /^scrypt\$v1\$N=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9+/=]+)\$([A-Za-z0-9+/=]+)$/.exec(
    hash,
  );
  if (!match) return null;
  const [, n, r, p, salt, key] = match;
  if (!n || !r || !p || !salt || !key) return null;
  return {
    params: { N: Number(n), r: Number(r), p: Number(p) },
    salt: Buffer.from(salt, 'base64'),
    key: Buffer.from(key, 'base64'),
  };
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (/[\uD800-\uDFFF]/u.test(password)) return false;
  const parsed = parse(hash);
  if (!parsed) return false;
  const key = await derive(password, parsed.salt, parsed.params);
  return key.length === parsed.key.length && timingSafeEqual(key, parsed.key);
}
