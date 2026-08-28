const db = require("../models");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");

const listRoles = catchAsync(async (req, res) => {
  const roles = await db.Role.findAll({ order: [["name", "ASC"]] });
  return sendSuccess(res, 200, roles);
});

module.exports = { listRoles };
