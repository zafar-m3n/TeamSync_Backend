const { dayjs } = require("../utils/time");

const DEFAULT_WORKING_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const workingDaysOf = (shift) => (shift && shift.workingDays?.length ? shift.workingDays : DEFAULT_WORKING_DAYS);

// holidays: a Set of 'YYYY-MM-DD'.
const isWorkingDay = (dateStr, workingDays, holidays) =>
  workingDays.includes(dayjs(dateStr).format("ddd")) && !holidays.has(dateStr);

// Working days in startDate–endDate, in total and per calendar year. A half day is 0.5.
const countWorkingDays = ({ startDate, endDate, isHalfDay }, workingDays, holidays) => {
  const unit = isHalfDay ? 0.5 : 1;
  const byYear = {};
  let total = 0;
  for (let d = dayjs(startDate); !d.isAfter(dayjs(endDate), "day"); d = d.add(1, "day")) {
    const ymd = d.format("YYYY-MM-DD");
    if (isWorkingDay(ymd, workingDays, holidays)) {
      byYear[d.year()] = (byYear[d.year()] || 0) + unit;
      total += unit;
    }
  }
  return { total, byYear };
};

const loadHolidays = async (startDate, endDate, { transaction } = {}) => {
  const db = require("../models");
  const { Op } = db.Sequelize;
  const rows = await db.Holiday.findAll({
    where: { date: { [Op.between]: [startDate, endDate] } },
    attributes: ["date"],
    transaction,
  });
  return new Set(rows.map((h) => h.date));
};

// Working days a leave range costs this employee: their shift's days, minus holidays.
const leaveDaysFor = async (employeeId, range, { transaction } = {}) => {
  const db = require("../models");
  const employee = await db.Employee.findByPk(employeeId, {
    attributes: ["id"],
    include: { association: "shift", attributes: ["workingDays"] },
    transaction,
  });
  const holidays = await loadHolidays(range.startDate, range.endDate, { transaction });
  return countWorkingDays(range, workingDaysOf(employee?.shift), holidays);
};

module.exports = {
  DEFAULT_WORKING_DAYS,
  workingDaysOf,
  isWorkingDay,
  countWorkingDays,
  loadHolidays,
  leaveDaysFor,
};
