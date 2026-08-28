const bcrypt = require("bcryptjs");
const db = require("../models");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");

const resetPassword = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  const user = await db.User.findByPk(id);

  if (!user) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }

  const saltRounds = parseInt(process.env.NODE_TEAMSYNC_BCRYPT_SALT_ROUNDS, 10) || 10;
  user.passwordHash = await bcrypt.hash(newPassword, saltRounds);
  await user.save();

  return sendSuccess(res, 200, { message: "Password reset successfully" });
});

module.exports = { resetPassword };
