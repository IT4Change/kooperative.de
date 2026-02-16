/**
 * rate-limit middleware
 *
 * Limits order creation to 5 requests per IP address per hour
 * to prevent abuse of the order endpoint.
 */

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const MAX_REQUESTS = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour in milliseconds

// Clean up expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

export default (config: any, { strapi }: { strapi: any }) => {
  return async (ctx: any, next: any) => {
    const clientIp =
      ctx.request.ip ||
      ctx.request.headers["x-forwarded-for"] ||
      ctx.request.headers["x-real-ip"] ||
      "unknown";

    const key = `order-rate-limit:${clientIp}`;
    const now = Date.now();

    let record = rateLimitStore.get(key);

    if (!record || now > record.resetAt) {
      // First request or window has expired - start a new window
      record = {
        count: 1,
        resetAt: now + WINDOW_MS,
      };
      rateLimitStore.set(key, record);
    } else {
      // Within the existing window
      record.count += 1;
    }

    // Set rate limit headers
    ctx.set("X-RateLimit-Limit", String(MAX_REQUESTS));
    ctx.set("X-RateLimit-Remaining", String(Math.max(0, MAX_REQUESTS - record.count)));
    ctx.set("X-RateLimit-Reset", String(Math.ceil(record.resetAt / 1000)));

    if (record.count > MAX_REQUESTS) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      ctx.set("Retry-After", String(retryAfter));

      return ctx.tooManyRequests(
        "Zu viele Bestellungen. Bitte versuchen Sie es später erneut."
      );
    }

    await next();
  };
};
