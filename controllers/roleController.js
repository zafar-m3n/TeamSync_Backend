const db = require("../models");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");
const { PERMISSION_MATRIX } = require("../constants/permissionMatrix");

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

  return sendSuccess(res, 201, role);
});

module.exports = { listRoles, createRole };
