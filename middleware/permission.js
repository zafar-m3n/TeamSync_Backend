const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const hasPermission = require("../utils/hasPermission");

const checkPermission = (module, action) =>
  catchAsync(async (req, res, next) => {
    if (!req.user || !req.user.roleId) {
      throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
    }

    const allowed = await hasPermission(req.user.roleId, module, action);

    if (!allowed) {
      throw new AppError(`You do not have permission to ${action} ${module}`, 403, "FORBIDDEN");
    }

    next();
  });

module.exports = { checkPermission };
