const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../models");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");

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

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  const token = jwt.sign(
    { userId: user.id, roleId: user.roleId, roleName: user.role.name },
    process.env.NODE_TEAMSYNC_JWT_SECRET,
    { expiresIn: process.env.NODE_TEAMSYNC_JWT_EXPIRES_IN },
  );

  return sendSuccess(res, 200, {
    token,
    user: {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
    },
  });
});

module.exports = { login };
