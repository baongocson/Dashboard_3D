/**
 * Limits failed login attempts with fixed windows, keyed by (IP + normalized username) and by IP.
 * Keying by username alone would let anyone lock a victim out; the IP key catches spraying.
 * In-memory: correct for the single-process modular monolith, resets on restart. A multi-instance
 * deployment needs a shared store (documented in docs/architecture/auth-contract.md).
 */
export interface LoginRateLimitOptions {
  windowMs: number;
  maxFailuresPerAccount: number;
  maxFailuresPerIp: number;
}
export const DEFAULT_LOGIN_RATE_LIMIT: LoginRateLimitOptions = {
  windowMs: 15 * 60 * 1000,
  maxFailuresPerAccount: 5,
  maxFailuresPerIp: 50,
};

interface Bucket {
  failures: number;
  resetAt: number;
}

export class LoginRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  constructor(private readonly options: LoginRateLimitOptions = DEFAULT_LOGIN_RATE_LIMIT) {}

  private keys(ip: string, usernameNormalized: string) {
    return { account: `a:${ip}:${usernameNormalized}`, ip: `i:${ip}` };
  }

  private active(key: string, now: number): Bucket | undefined {
    const bucket = this.buckets.get(key);
    if (bucket && bucket.resetAt <= now) {
      this.buckets.delete(key);
      return undefined;
    }
    return bucket;
  }

  /** Seconds until another attempt is allowed, or null when allowed now. */
  retryAfterSeconds(ip: string, usernameNormalized: string, now: number): number | null {
    const keys = this.keys(ip, usernameNormalized);
    const limits: [string, number][] = [
      [keys.account, this.options.maxFailuresPerAccount],
      [keys.ip, this.options.maxFailuresPerIp],
    ];
    let wait: number | null = null;
    for (const [key, max] of limits) {
      const bucket = this.active(key, now);
      if (bucket && bucket.failures >= max) {
        const seconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
        wait = Math.max(wait ?? 0, seconds);
      }
    }
    return wait;
  }

  recordFailure(ip: string, usernameNormalized: string, now: number): void {
    this.sweep(now);
    const keys = this.keys(ip, usernameNormalized);
    for (const key of [keys.account, keys.ip]) {
      const bucket = this.active(key, now);
      if (bucket) bucket.failures += 1;
      else this.buckets.set(key, { failures: 1, resetAt: now + this.options.windowMs });
    }
  }

  /** A successful login clears the per-account counter (not the per-IP one). */
  recordSuccess(ip: string, usernameNormalized: string): void {
    this.buckets.delete(this.keys(ip, usernameNormalized).account);
  }

  private sweep(now: number): void {
    if (this.buckets.size < 10_000) return;
    for (const [key, bucket] of this.buckets) if (bucket.resetAt <= now) this.buckets.delete(key);
  }
}
