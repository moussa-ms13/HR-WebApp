// ============================================================
// Lightweight In-Memory Sliding-Window Rate Limiter
// Bounded map size + periodic pruning to prevent memory leaks.
// ============================================================
const { extractClientIp } = require("../utils/requestContext");

function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 20,
  message = "تم تجاوز الحد المسموح من المحاولات. يرجى الانتظار قليلاً ثم إعادة المحاولة.",
  maxTrackedIps = 5000,
} = {}) {
  const hits = new Map();

  // Periodic cleanup of expired entries (unref so it never blocks graceful shutdown)
  const cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, timestamps] of hits.entries()) {
      const valid = timestamps.filter((t) => t > cutoff);
      if (valid.length === 0) hits.delete(key);
      else hits.set(key, valid);
    }
  }, Math.min(windowMs, 5 * 60 * 1000));
  if (typeof cleanupTimer.unref === "function") {
    cleanupTimer.unref();
  }

  return (req, res, next) => {
    const ip = extractClientIp(req) || req.ip || "unknown";
    const now = Date.now();
    const cutoff = now - windowMs;

    if (!hits.has(ip) && hits.size >= maxTrackedIps) {
      // Evict oldest tracked key when at capacity
      const oldestKey = hits.keys().next().value;
      if (oldestKey !== undefined) hits.delete(oldestKey);
    }

    const timestamps = (hits.get(ip) || []).filter((t) => t > cutoff);
    if (timestamps.length >= max) {
      const retryAfterSec = Math.max(1, Math.ceil((timestamps[0] + windowMs - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({
        success: false,
        message,
      });
    }

    timestamps.push(now);
    hits.set(ip, timestamps);
    return next();
  };
}

module.exports = { createRateLimiter };
