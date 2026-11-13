// roleId -> Promise<Set<"module.action">> of allowed permissions. In-memory, per process.
const cache = new Map();

const loadRolePermissions = async (roleId) => {
  const db = require("../models");
  const rows = await db.Permission.findAll({
    where: { roleId, allowed: true },
    attributes: ["module", "action"],
  });
  return new Set(rows.map((p) => `${p.module}.${p.action}`));
};

const getRolePermissions = (roleId) => {
  const key = Number(roleId);
  if (!cache.has(key)) {
    const pending = loadRolePermissions(key).catch((err) => {
      cache.delete(key);
      throw err;
    });
    cache.set(key, pending);
  }
  return cache.get(key);
};

const invalidateRolePermissions = (roleId) => {
  cache.delete(Number(roleId));
};

const hasPermission = async (roleId, moduleName, action) => {
  const allowed = await getRolePermissions(roleId);
  return allowed.has(`${moduleName}.${action}`);
};

module.exports = hasPermission;
module.exports.getRolePermissions = getRolePermissions;
module.exports.invalidateRolePermissions = invalidateRolePermissions;
