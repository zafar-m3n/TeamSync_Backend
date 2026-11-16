const db = require("../models");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess, sendAction } = require("../utils/apiResponse");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const { assertOutranks } = require("../services/roleRankService");
const { hashPassword } = require("../utils/password");
const { setPasswordAndRevoke } = require("../services/sessionService");
const { blocksAccess } = require("../services/employmentStatusService");

const resetPassword = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  const user = await db.User.findByPk(id);

  if (!user) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }

  await assertOutranks(req, user.roleId);

  await setPasswordAndRevoke(user, await hashPassword(newPassword));

  return sendAction(res, "Password reset successfully");
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
    attributes: { exclude: db.User.SECRET_ATTRIBUTES },
  });

  return sendSuccess(res, 200, rows, buildPaginationMeta(page, limit, count));
});

const getUser = catchAsync(async (req, res) => {
  const user = await db.User.findByPk(req.params.id, {
    include: "role",
    attributes: { exclude: db.User.SECRET_ATTRIBUTES },
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

  await assertOutranks(req, user.roleId);

  if (isActive) {
    const employee = await db.Employee.findOne({ where: { userId: user.id } });
    if (employee && blocksAccess(employee)) {
      throw new AppError(
        `Cannot activate this account while the employee is ${employee.employmentStatus}`,
        409,
        "EMPLOYEE_NOT_ACTIVE",
      );
    }
  }

  user.isActive = isActive;
  await user.save();

  const updated = await db.User.findByPk(user.id, {
    include: "role",
    attributes: { exclude: db.User.SECRET_ATTRIBUTES },
  });

  return sendSuccess(res, 200, updated);
});

module.exports = { resetPassword, listUsers, getUser, updateStatus };
