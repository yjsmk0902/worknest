import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { AppError } from '../lib/errors';

// ── In-Memory Rate Limiter ─────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Simple in-memory sliding-window rate limiter.
 *
 * MVP uses in-memory storage. For v1.0 multi-instance deployments,
 * swap to a Redis-backed adapter behind the same interface.
 */
class InMemoryRateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Clean expired entries every 60 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  /**
   * Check and increment the counter for a given key.
   * Returns true if the request is allowed, false if rate-limited.
   */
  check(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now >= entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    entry.count += 1;
    return entry.count <= maxRequests;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Singleton limiter instance
const limiter = new InMemoryRateLimiter();

// ── Helpers ────────────────────────────────────────────────────────────

function getClientKey(request: FastifyRequest): string {
  // Prefer user ID for authenticated requests, fall back to IP
  return request.user?.id ?? request.ip;
}

// ── Middleware Factories ───────────────────────────────────────────────

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  /** Optional prefix to namespace the rate limit bucket */
  prefix?: string;
}

/**
 * Create a rate-limiting preHandler with the given configuration.
 */
export function createRateLimit(opts: RateLimitOptions): preHandlerHookHandler {
  return async function rateLimit(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const prefix = opts.prefix ?? 'global';
    const key = `${prefix}:${getClientKey(request)}`;

    const allowed = limiter.check(key, opts.maxRequests, opts.windowMs);
    if (!allowed) {
      throw AppError.rateLimited();
    }
  };
}

// ── Pre-configured Rate Limiters ───────────────────────────────────────

/** Global API rate limit: 1000 requests per minute */
export const globalRateLimit = createRateLimit({
  maxRequests: 1000,
  windowMs: 60_000,
  prefix: 'global',
});

/** Auth rate limit: 10 requests per 15 minutes */
export const authRateLimit = createRateLimit({
  maxRequests: 10,
  windowMs: 15 * 60_000,
  prefix: 'auth',
});
