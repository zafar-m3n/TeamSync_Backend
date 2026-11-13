const AppError = require("../utils/AppError");

const getRequesterEmployee = async (req, { required = true } = {}) => {
  if (req.requesterEmployee === undefined) {
    const db = require("../models");
    req.requesterEmployee = await db.Employee.findOne({ where: { userId: req.user.id } });
  }

  if (!req.requesterEmployee && required) {
    throw new AppError("No employee profile linked to this account", 404, "NO_EMPLOYEE_PROFILE");
  }

  return req.requesterEmployee;
};

module.exports = { getRequesterEmployee };
