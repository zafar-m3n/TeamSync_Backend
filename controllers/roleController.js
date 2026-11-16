const db = require("../models");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess, sendDeleted } = require("../utils/apiResponse");
const { PERMISSION_MATRIX } = require("../constants/permissionMatrix");
const { invalidateRolePermissions } = require("../utils/hasPermission");
const isValueTaken = require("../utils/isValueTaken");

const findRole = async (id) => {
  const role = await db.Role.findByPk(id);
  if (!role) {
    throw new AppError("Role not found", 404, "NOT_FOUND");
  }
  return role;
};

// Code and seed match the base roles by name, so their names are fixed.
const baseRoleLocked = (action) =>
  new AppError(`Built-in roles cannot be ${action}`, 400, "BASE_ROLE_LOCKED");

// Live (not soft-deleted) users holding the role, so the UI can warn before a delete.
const USER_COUNT = [
  db.sequelize.literal(
    "(SELECT COUNT(*) FROM users u WHERE u.role_id = `Role`.`id` AND u.deleted_at IS NULL)",
  ),
  "userCount",
];

const listRoles = catchAsync(async (req, res) => {
  const roles = await db.Role.findAll({
    attributes: { include: [USER_COUNT] },
    order: [["name", "ASC"]],
  });
  return sendSuccess(res, 200, roles);
});

const createRole = catchAsync(async (req, res) => {
  const { name, description } = req.body;

  const existing = await db.Role.findOne({ where: { name } });
  if (existing) {
    throw new AppError("A role with this name already exists", 409, "ROLE_NAME_TAKEN");
  }

  const role = await db.sequelize.transaction(async (t) => {
    const created = await db.Role.create({ name, description, isCustom: true }, { transaction: t });

    const permissionRows = PERMISSION_MATRIX.map((entry) => ({
      roleId: created.id,
      module: entry.module,
      action: entry.action,
      allowed: false,
    }));
    await db.Permission.bulkCreate(permissionRows, { transaction: t });

    return created;
  });
  invalidateRolePermissions(role.id);

  return sendSuccess(res, 201, role);
});

const updateRole = catchAsync(async (req, res) => {
  const role = await findRole(req.params.id);
  const { name, description } = req.body;

  if (name !== undefined && name !== role.name) {
    if (!role.isCustom) {
      throw baseRoleLocked("renamed");
    }
    if (await isValueTaken(db.Role, "name", name, { excludeId: role.id })) {
      throw new AppError("A role with this name already exists", 409, "ROLE_NAME_TAKEN");
    }
  }

  await role.update({
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
  });

  return sendSuccess(res, 200, role);
});

const deleteRole = catchAsync(async (req, res) => {
  const role = await findRole(req.params.id);
  if (!role.isCustom) {
    throw baseRoleLocked("deleted");
  }

  await db.sequelize.transaction(async (t) => {
    const count = await db.User.count({ where: { roleId: role.id }, transaction: t });
    if (count > 0) {
      throw new AppError(
        `This role is assigned to ${count} user(s). Reassign them first.`,
        409,
        "ROLE_HAS_USERS",
        { count },
      );
    }

    // Soft-deleted users still hold the FK (ON DELETE RESTRICT); they can't log in anyway.
    const fallback = await db.Role.findOne({
      where: { name: "Employee", isCustom: false },
      transaction: t,
    });
    await db.User.update(
      { roleId: fallback.id },
      { where: { roleId: role.id }, paranoid: false, transaction: t },
    );
    await db.Permission.destroy({ where: { roleId: role.id }, transaction: t });
    await role.destroy({ transaction: t });
  });
  invalidateRolePermissions(role.id);

  return sendDeleted(res, role.id, "Role deleted");
});

module.exports = { listRoles, createRole, updateRole, deleteRole };
