const { getRolePermissions } = require("../utils/hasPermission");
const { outranksAll } = require("../utils/roleRank");

// The signed-in user plus everything the frontend needs to gate the UI.
const buildSessionUser = async (user) => {
  const db = require("../models");
  const [employee, permissions] = await Promise.all([
    db.Employee.findOne({ where: { userId: user.id }, attributes: ["id"] }),
    getRolePermissions(user.roleId),
  ]);

  return {
    id: user.id,
    email: user.email,
    roleId: user.roleId,
    roleName: user.role.name,
    roleIsCustom: user.role.isCustom,
    roleRank: user.role.rank,
    outranksAll: outranksAll(user.role),
    employeeId: employee ? employee.id : null,
    permissions: [...permissions].sort(),
  };
};

module.exports = { buildSessionUser };
