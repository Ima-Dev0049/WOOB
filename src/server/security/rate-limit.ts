import { ApiError } from '@/server/http';

type Bucket = { count: number; resetAt: number };
const globalLimit = globalThis as typeof globalThis & { __woobRateLimits?: Map<string, Bucket> };
const buckets = globalLimit.__woobRateLimits ??= new Map<string, Bucket>();

export function rateLimit(key: string, options: { windowMs?: number; max?: number } = {}): void {
  const windowMs = options.windowMs ?? Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
  const max = options.max ?? Number(process.env.RATE_LIMIT_MAX || 120);
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  current.count += 1;
  if (current.count > max) {
    const error = new ApiError(429, 'RATE_LIMITED', 'Trop de tentatives. Réessayez dans un instant.', { retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) });
    throw error;
  }
  if (buckets.size > 10_000) {
    for (const [bucketKey, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(bucketKey);
  }
}

export function requestIp(request: Request): string {
  if (process.env.TRUST_PROXY !== 'true') return 'direct';
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'proxy-unknown';
}
