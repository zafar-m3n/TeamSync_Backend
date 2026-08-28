const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

const checkPermission = (module, action) =>
  catchAsync(async (req, res, next) => {
    const db = require("../models");

    if (!req.user || !req.user.roleId) {
      throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
    }

    const permission = await db.Permission.findOne({
      where: {
        role_id: req.user.roleId,
        module,
        action,
      },
    });

    if (!permission || !permission.allowed) {
      throw new AppError(`You do not have permission to ${action} ${module}`, 403, "FORBIDDEN");
    }

    next();
  });

module.exports = { checkPermission };
