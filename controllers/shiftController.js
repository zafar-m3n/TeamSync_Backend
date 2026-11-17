const db = require("../models");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess, sendDeleted } = require("../utils/apiResponse");
const { statusFilter } = require("../services/employmentStatusService");

const createShift = catchAsync(async (req, res) => {
  const shift = await db.Shift.create(req.body);
  return sendSuccess(res, 201, shift);
});

const listShifts = catchAsync(async (req, res) => {
  const shifts = await db.Shift.findAll({ order: [["name", "ASC"]] });
  return sendSuccess(res, 200, shifts);
});

const findShift = async (id) => {
  const shift = await db.Shift.findByPk(id);
  if (!shift) {
    throw new AppError("Shift not found", 404, "NOT_FOUND");
  }
  return shift;
};

const getShift = catchAsync(async (req, res) => {
  const shift = await findShift(req.params.id);
  return sendSuccess(res, 200, shift);
});

const updateShift = catchAsync(async (req, res) => {
  const shift = await findShift(req.params.id);
  await shift.update(req.body);
  return sendSuccess(res, 200, shift);
});

const deleteShift = catchAsync(async (req, res) => {
  const shift = await findShift(req.params.id);

  await db.sequelize.transaction(async (t) => {
    // Only current employees (incl. suspended or still serving notice) keep a shift in use.
    const count = await db.Employee.count({
      where: { shiftId: shift.id, ...statusFilter("current", db.Sequelize.Op) },
      transaction: t,
    });
    if (count > 0) {
      throw new AppError(
        `This shift is assigned to ${count} employee(s). Reassign them first.`,
        409,
        "SHIFT_HAS_EMPLOYEES",
        { count },
      );
    }

    // Former and soft-deleted employees are all that can still point at it now.
    await db.Employee.update(
      { shiftId: null },
      { where: { shiftId: shift.id }, paranoid: false, transaction: t },
    );
    await shift.destroy({ transaction: t });
  });

  return sendDeleted(res, shift.id, "Shift deleted");
});

module.exports = { createShift, listShifts, getShift, updateShift, deleteShift };
