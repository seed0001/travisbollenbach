// A tiny in-memory per-IP rate limiter shared by the routes that spend an
// owner's (or the operator's) API credits. Best-effort — resets on redeploy,
// per-instance — but enough to stop a single client from draining a key.

const buckets = new Map<string, Map<string, number[]>>();

export function rateLimited(
  scope: string,
  ip: string,
  limit: number,
  windowMs: number,
): boolean {
  let bucket = buckets.get(scope);
  if (!bucket) {
    bucket = new Map();
    buckets.set(scope, bucket);
  }
  const now = Date.now();
  const stamps = (bucket.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (stamps.length >= limit) {
    bucket.set(ip, stamps);
    return true;
  }
  stamps.push(now);
  bucket.set(ip, stamps);
  return false;
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  );
}
