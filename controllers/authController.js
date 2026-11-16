const db = require("../models");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess, sendAction } = require("../utils/apiResponse");
const {
  buildSessionUser,
  signToken,
  revokeSessions,
  setPasswordAndRevoke,
} = require("../services/sessionService");
const { hashPassword, passwordMatches } = require("../utils/password");

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const user = await db.User.findOne({
    where: { email },
    include: [{ model: db.Role, as: "role" }],
  });

  if (!user) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  if (!user.isActive) {
    throw new AppError("Account is inactive", 403, "ACCOUNT_INACTIVE");
  }

  if (!(await passwordMatches(password, user.passwordHash))) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  return sendSuccess(res, 200, { token: signToken(user), user: await buildSessionUser(user) });
});

const me = catchAsync(async (req, res) => {
  const user = await db.User.findByPk(req.user.id, { include: [{ model: db.Role, as: "role" }] });
  return sendSuccess(res, 200, await buildSessionUser(user));
});

const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await db.User.findByPk(req.user.id);

  if (!(await passwordMatches(currentPassword, user.passwordHash))) {
    throw new AppError("Current password is incorrect", 400, "WRONG_PASSWORD", [
      { field: "currentPassword", message: "Current password is incorrect" },
    ]);
  }

  await setPasswordAndRevoke(user, await hashPassword(newPassword));

  // Every other session is now revoked; this one continues with a fresh token.
  return sendSuccess(res, 200, { token: signToken(user) });
});

const logout = catchAsync(async (req, res) => {
  await revokeSessions(req.user.id);
  return sendAction(res, "Logged out");
});

module.exports = { login, me, changePassword, logout };
