import type { Context } from 'hono';

/**
 * The visitor's address for rate limiting. The platform proxy appends the real client address
 * as the LAST x-forwarded-for entry; earlier entries are whatever the client sent, so never trust them.
 */
export function clientIp(c: Context): string {
  const xff = c.req.header('x-forwarded-for');
  if (xff) {
    const last = xff.split(',').map((s) => s.trim()).filter(Boolean).at(-1);
    if (last) return last;
  }
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming;
  return incoming?.socket?.remoteAddress ?? 'unknown';
}
