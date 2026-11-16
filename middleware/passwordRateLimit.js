const AppError = require("../utils/AppError");
const { createFixedWindowCounter } = require("../utils/fixedWindowCounter");

const WINDOW_MS = 15 * 60 * 1000;

// Every attempt on any password route counts per IP.
const ipAttempts = createFixedWindowCounter({ windowMs: WINDOW_MS, max: 20 });

// Only failed passwords count per account (failureStatus), and a success clears that count.
const createPasswordRateLimit = ({ label, accountKey, failureStatus }) => {
  const accountFailures = createFixedWindowCounter({ windowMs: WINDOW_MS, max: 5 });

  return (req, res, next) => {
    const ip = req.ip;
    const account = accountKey(req);

    const wait = Math.max(ipAttempts.retryAfter(ip), account ? accountFailures.retryAfter(account) : 0);
    if (wait > 0) {
      res.set("Retry-After", String(wait));
      const minutes = Math.ceil(wait / 60);
      return next(
        new AppError(
          `Too many ${label} attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
          429,
          "TOO_MANY_ATTEMPTS",
        ),
      );
    }

    ipAttempts.hit(ip);

    if (account) {
      res.on("finish", () => {
        if (res.statusCode === failureStatus) {
          accountFailures.hit(account);
        } else if (res.statusCode === 200) {
          accountFailures.reset(account);
        }
      });
    }

    next();
  };
};

const loginRateLimit = createPasswordRateLimit({
  label: "login",
  accountKey: (req) => String(req.body?.email ?? "").trim().toLowerCase(),
  failureStatus: 401,
});

// Runs after verifyToken and validation, so the only 400 left is a wrong current password.
const changePasswordRateLimit = createPasswordRateLimit({
  label: "password change",
  accountKey: (req) => String(req.user.id),
  failureStatus: 400,
});

module.exports = { loginRateLimit, changePasswordRateLimit };
