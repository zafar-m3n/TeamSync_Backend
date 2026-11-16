const jwt = require("jsonwebtoken");
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

// `tv` must match users.token_version; bumping the column revokes every older token.
const signToken = (user) =>
  jwt.sign(
    { userId: user.id, roleId: user.roleId, tv: user.tokenVersion },
    process.env.NODE_TEAMSYNC_JWT_SECRET,
    { expiresIn: process.env.NODE_TEAMSYNC_JWT_EXPIRES_IN },
  );

const revokeSessions = (userId, options = {}) => {
  const db = require("../models");
  return db.User.increment("tokenVersion", { where: { id: userId }, ...options });
};

// Sets a new password and revokes the user's existing sessions in one transaction.
const setPasswordAndRevoke = async (user, passwordHash) => {
  const db = require("../models");
  await db.sequelize.transaction(async (transaction) => {
    user.passwordHash = passwordHash;
    await user.save({ transaction });
    await revokeSessions(user.id, { transaction });
  });
  await user.reload();
};

module.exports = { buildSessionUser, signToken, revokeSessions, setPasswordAndRevoke };
