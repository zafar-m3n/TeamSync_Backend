const bcrypt = require("bcryptjs");
const db = require("../models");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");

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

const listUsers = catchAsync(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);

  const where = {};
  if (req.query.roleId !== undefined) {
    where.roleId = req.query.roleId;
  }
  if (req.query.isActive !== undefined) {
    where.isActive = req.query.isActive === "true";
  }

  const { rows, count } = await db.User.findAndCountAll({
    where,
    limit,
    offset,
    order: [["email", "ASC"]],
    include: "role",
    attributes: { exclude: ["passwordHash"] },
  });

  return sendSuccess(res, 200, rows, buildPaginationMeta(page, limit, count));
});

const getUser = catchAsync(async (req, res) => {
  const user = await db.User.findByPk(req.params.id, {
    include: "role",
    attributes: { exclude: ["passwordHash"] },
  });

  if (!user) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }

  return sendSuccess(res, 200, user);
});

const updateStatus = catchAsync(async (req, res) => {
  const { isActive } = req.body;

  const user = await db.User.findByPk(req.params.id);

  if (!user) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }

  if (req.user.id === user.id && isActive === false) {
    throw new AppError("You cannot deactivate your own account", 400, "CANNOT_DEACTIVATE_SELF");
  }

  user.isActive = isActive;
  await user.save();

  const updated = await db.User.findByPk(user.id, {
    include: "role",
    attributes: { exclude: ["passwordHash"] },
  });

  return sendSuccess(res, 200, updated);
});

module.exports = { resetPassword, listUsers, getUser, updateStatus };
