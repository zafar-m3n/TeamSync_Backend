const AppError = require("../utils/AppError");
const { createFixedWindowCounter } = require("../utils/fixedWindowCounter");

const WINDOW_MS = 15 * 60 * 1000;

// Every attempt counts per IP; only failed passwords count per email, and a
// successful login clears that email's count.
const ipAttempts = createFixedWindowCounter({ windowMs: WINDOW_MS, max: 20 });
const emailFailures = createFixedWindowCounter({ windowMs: WINDOW_MS, max: 5 });

const loginRateLimit = (req, res, next) => {
  const ip = req.ip;
  const email = String(req.body?.email ?? "").trim().toLowerCase();

  const wait = Math.max(ipAttempts.retryAfter(ip), email ? emailFailures.retryAfter(email) : 0);
  if (wait > 0) {
    res.set("Retry-After", String(wait));
    const minutes = Math.ceil(wait / 60);
    return next(
      new AppError(
        `Too many login attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
        429,
        "TOO_MANY_ATTEMPTS",
      ),
    );
  }

  ipAttempts.hit(ip);

  if (email) {
    res.on("finish", () => {
      if (res.statusCode === 401) {
        emailFailures.hit(email);
      } else if (res.statusCode === 200) {
        emailFailures.reset(email);
      }
    });
  }

  next();
};

module.exports = { loginRateLimit };
