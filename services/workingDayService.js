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

// The same for many requests at once: one query for shifts, one for holidays.
// Returns a Map of request id → { total, byYear }.
const leaveDaysForMany = async (requests, { transaction } = {}) => {
  const result = new Map();
  if (!requests.length) {
    return result;
  }
  const db = require("../models");
  const employeeIds = [...new Set(requests.map((r) => r.employeeId))];
  const employees = await db.Employee.findAll({
    where: { id: employeeIds },
    attributes: ["id"],
    include: { association: "shift", attributes: ["workingDays"] },
    paranoid: false,
    transaction,
  });
  const daysByEmployee = new Map(employees.map((e) => [e.id, workingDaysOf(e.shift)]));
  const from = requests.reduce((min, r) => (r.startDate < min ? r.startDate : min), requests[0].startDate);
  const to = requests.reduce((max, r) => (r.endDate > max ? r.endDate : max), requests[0].endDate);
  const holidays = await loadHolidays(from, to, { transaction });

  for (const r of requests) {
    const workingDays = daysByEmployee.get(r.employeeId) ?? DEFAULT_WORKING_DAYS;
    result.set(r.id, countWorkingDays(r, workingDays, holidays));
  }
  return result;
};

module.exports = {
  DEFAULT_WORKING_DAYS,
  leaveDaysForMany,
  workingDaysOf,
  isWorkingDay,
  countWorkingDays,
  loadHolidays,
  leaveDaysFor,
};
