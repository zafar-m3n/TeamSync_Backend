// In-memory fixed-window counter, per process. Each key gets `max` hits per `windowMs`,
// counted from its first hit in the window.
const createFixedWindowCounter = ({ windowMs, max }) => {
  const entries = new Map();

  const live = (key, now) => {
    const entry = entries.get(key);
    if (entry && entry.resetAt > now) {
      return entry;
    }
    entries.delete(key);
    return null;
  };

  // Seconds until the key may try again, or 0 when it is not blocked.
  const retryAfter = (key, now = Date.now()) => {
    const entry = live(key, now);
    return entry && entry.count >= max ? Math.ceil((entry.resetAt - now) / 1000) : 0;
  };

  const hit = (key, now = Date.now()) => {
    const entry = live(key, now) || { count: 0, resetAt: now + windowMs };
    entry.count += 1;
    entries.set(key, entry);
  };

  const reset = (key) => {
    entries.delete(key);
  };

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const key of entries.keys()) {
      live(key, now);
    }
  }, windowMs);
  sweep.unref();

  return { retryAfter, hit, reset };
};

module.exports = { createFixedWindowCounter };
