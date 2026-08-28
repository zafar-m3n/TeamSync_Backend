const db = require("../models");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");

const ADMIN_LOCKOUT_MESSAGE =
  "Cannot revoke Admin's own permission-management access — this would lock everyone out of the permissions screen";

const wouldLockOutAdmin = (permission, allowed) =>
  permission.role.name === "Admin" &&
  permission.module === "permissions" &&
  permission.action === "manage" &&
  allowed === false;

const listPermissions = catchAsync(async (req, res) => {
  const where = {};
  if (req.query.roleId !== undefined) {
    where.roleId = req.query.roleId;
  }

  const permissions = await db.Permission.findAll({
    where,
    include: "role",
    order: [
      ["module", "ASC"],
      ["action", "ASC"],
    ],
  });

  return sendSuccess(res, 200, permissions);
});

const updatePermission = catchAsync(async (req, res) => {
  const { allowed } = req.body;

  const permission = await db.Permission.findByPk(req.params.id, { include: "role" });

  if (!permission) {
    throw new AppError("Permission not found", 404, "NOT_FOUND");
  }

  if (wouldLockOutAdmin(permission, allowed)) {
    throw new AppError(ADMIN_LOCKOUT_MESSAGE, 400, "CANNOT_REVOKE_ADMIN_PERMISSION_MANAGEMENT");
  }

  permission.allowed = allowed;
  await permission.save();

  return sendSuccess(res, 200, permission);
});

const bulkUpdatePermissions = catchAsync(async (req, res) => {
  const { updates } = req.body;
  const ids = updates.map((u) => u.id);

  const permissions = await db.Permission.findAll({
    where: { id: ids },
    include: "role",
  });
  const byId = new Map(permissions.map((p) => [p.id, p]));

  for (const { id } of updates) {
    if (!byId.has(id)) {
      throw new AppError("Permission not found", 404, "NOT_FOUND");
    }
  }

  for (const { id, allowed } of updates) {
    if (wouldLockOutAdmin(byId.get(id), allowed)) {
      throw new AppError(ADMIN_LOCKOUT_MESSAGE, 400, "CANNOT_REVOKE_ADMIN_PERMISSION_MANAGEMENT");
    }
  }

  await db.sequelize.transaction(async (t) => {
    for (const { id, allowed } of updates) {
      await byId.get(id).update({ allowed }, { transaction: t });
    }
  });

  return sendSuccess(res, 200, { updated: updates.length });
});

module.exports = { listPermissions, updatePermission, bulkUpdatePermissions };
