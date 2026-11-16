const db = require("../models");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");
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

const listRoles = catchAsync(async (req, res) => {
  const roles = await db.Role.findAll({ order: [["name", "ASC"]] });
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

module.exports = { listRoles, createRole, updateRole };
