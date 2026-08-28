const hasPermission = async (roleId, moduleName, action) => {
  const db = require("../models");
  const permission = await db.Permission.findOne({
    where: { roleId, module: moduleName, action },
  });
  return !!(permission && permission.allowed);
};

module.exports = hasPermission;
