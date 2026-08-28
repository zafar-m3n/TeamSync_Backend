const db = require("../models");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");

const createShift = catchAsync(async (req, res) => {
  const shift = await db.Shift.create(req.body);
  return sendSuccess(res, 201, shift);
});

const listShifts = catchAsync(async (req, res) => {
  const shifts = await db.Shift.findAll({ order: [["name", "ASC"]] });
  return sendSuccess(res, 200, shifts);
});

const getShift = catchAsync(async (req, res) => {
  const shift = await db.Shift.findByPk(req.params.id);
  if (!shift) {
    throw new AppError("Shift not found", 404, "NOT_FOUND");
  }
  return sendSuccess(res, 200, shift);
});

const updateShift = catchAsync(async (req, res) => {
  const shift = await db.Shift.findByPk(req.params.id);
  if (!shift) {
    throw new AppError("Shift not found", 404, "NOT_FOUND");
  }
  await shift.update(req.body);
  return sendSuccess(res, 200, shift);
});

module.exports = { createShift, listShifts, getShift, updateShift };
