const AppError = require("../utils/AppError");
const hasPermission = require("../utils/hasPermission");
const { rankOf } = require("../utils/roleRank");

const findRole = (roleId) => {
  const db = require("../models");
  return db.Role.findByPk(roleId);
};

// roles.manage may assign any role; everyone else only roles ranked strictly below their own.
const assertCanAssignRole = async (req, roleId) => {
  const role = await findRole(roleId);
  if (!role) {
    throw new AppError("Role not found", 404, "ROLE_NOT_FOUND");
  }

  if (await hasPermission(req.user.roleId, "roles", "manage")) {
    return;
  }

  const requesterRole = await findRole(req.user.roleId);
  if (rankOf(role) >= rankOf(requesterRole)) {
    throw new AppError(
      `You cannot assign the ${role.name} role`,
      403,
      "ROLE_ASSIGNMENT_FORBIDDEN",
    );
  }
};

module.exports = { assertCanAssignRole };
