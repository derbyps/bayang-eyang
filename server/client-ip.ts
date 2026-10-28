import type { Context } from 'hono';

/**
 * The visitor's address for rate limiting.
 * Render sits behind Cloudflare, whose edge overwrites cf-connecting-ip / true-client-ip with the real
 * visitor. Render's x-forwarded-for keeps whatever the client sent and appends varying proxy addresses,
 * so it is only a fallback for other hosts (where the last entry is the one the proxy added).
 */
export function clientIp(c: Context): string {
  const edge = c.req.header('cf-connecting-ip') ?? c.req.header('true-client-ip');
  if (edge?.trim()) return edge.trim();
  const xff = c.req.header('x-forwarded-for');
  if (xff) {
    const last = xff.split(',').map((s) => s.trim()).filter(Boolean).at(-1);
    if (last) return last;
  }
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming;
  return incoming?.socket?.remoteAddress ?? 'unknown';
}
