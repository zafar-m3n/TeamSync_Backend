const db = require("../models");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");

const createLeaveType = catchAsync(async (req, res) => {
  const { name, description } = req.body;

  const existing = await db.LeaveType.findOne({ where: { name } });
  if (existing) {
    throw new AppError("A leave type with this name already exists", 409, "LEAVE_TYPE_NAME_TAKEN");
  }

  const leaveType = await db.LeaveType.create({ name, description });
  return sendSuccess(res, 201, leaveType);
});

const listLeaveTypes = catchAsync(async (req, res) => {
  const leaveTypes = await db.LeaveType.findAll({ order: [["name", "ASC"]] });
  return sendSuccess(res, 200, leaveTypes);
});

const updateLeaveType = catchAsync(async (req, res) => {
  const leaveType = await db.LeaveType.findByPk(req.params.id);
  if (!leaveType) {
    throw new AppError("Leave type not found", 404, "NOT_FOUND");
  }

  const { name, description } = req.body;

  if (name && name !== leaveType.name) {
    const taken = await db.LeaveType.findOne({ where: { name } });
    if (taken) {
      throw new AppError("A leave type with this name already exists", 409, "LEAVE_TYPE_NAME_TAKEN");
    }
  }

  await leaveType.update(req.body);
  return sendSuccess(res, 200, leaveType);
});

const deleteLeaveType = catchAsync(async (req, res) => {
  const leaveType = await db.LeaveType.findByPk(req.params.id);
  if (!leaveType) {
    throw new AppError("Leave type not found", 404, "NOT_FOUND");
  }

  // paranoid: false — a soft-deleted request still holds the FK, so the DB's
  // ON DELETE RESTRICT would still fire; count those too for a clean 409.
  const referencing = await db.LeaveRequest.count({
    where: { leaveTypeId: leaveType.id },
    paranoid: false,
  });
  if (referencing > 0) {
    throw new AppError(
      "Cannot delete a leave type that has requests referencing it",
      409,
      "LEAVE_TYPE_IN_USE",
    );
  }

  await leaveType.destroy();
  return sendSuccess(res, 200, { message: "Leave type deleted" });
});

module.exports = { createLeaveType, listLeaveTypes, updateLeaveType, deleteLeaveType };
