const db = require("../models");
const { Op } = db.Sequelize;
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess, sendDeleted } = require("../utils/apiResponse");
const { nowTz } = require("../utils/time");

const assertDateFree = async (date, exceptId) => {
  const where = { date };
  if (exceptId) {
    where.id = { [Op.ne]: exceptId };
  }
  if (await db.Holiday.findOne({ where })) {
    throw new AppError("A holiday already exists on this date", 409, "HOLIDAY_DATE_TAKEN");
  }
};

const findHoliday = async (id) => {
  const holiday = await db.Holiday.findByPk(id);
  if (!holiday) {
    throw new AppError("Holiday not found", 404, "NOT_FOUND");
  }
  return holiday;
};

const listHolidays = catchAsync(async (req, res) => {
  const year = req.validatedQuery?.year ?? nowTz().year();
  const holidays = await db.Holiday.findAll({
    where: { date: { [Op.between]: [`${year}-01-01`, `${year}-12-31`] } },
    order: [["date", "ASC"]],
  });
  return sendSuccess(res, 200, holidays);
});

const createHoliday = catchAsync(async (req, res) => {
  const { name, date } = req.body;
  await assertDateFree(date);
  const holiday = await db.Holiday.create({ name, date });
  return sendSuccess(res, 201, holiday);
});

const updateHoliday = catchAsync(async (req, res) => {
  const holiday = await findHoliday(req.params.id);
  if (req.body.date) {
    await assertDateFree(req.body.date, holiday.id);
  }
  await holiday.update(req.body);
  return sendSuccess(res, 200, holiday);
});

const deleteHoliday = catchAsync(async (req, res) => {
  const holiday = await findHoliday(req.params.id);
  await holiday.destroy();
  return sendDeleted(res, holiday.id, "Holiday deleted");
});

module.exports = { listHolidays, createHoliday, updateHoliday, deleteHoliday };
