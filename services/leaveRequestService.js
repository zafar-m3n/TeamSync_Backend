const db = require("../models");
const AppError = require("../utils/AppError");
const { dayjs } = require("../utils/time");
const { leaveDaysForMany } = require("./workingDayService");
const { lockBalance } = require("./leaveBalanceService");

const { Op } = db.Sequelize;

// Row-locks the employee so leave changes for one person run one at a time.
const lockEmployee = (employeeId, transaction) =>
  db.Employee.findByPk(employeeId, {
    attributes: ["id"],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

// Throws 409 LEAVE_OVERLAP if any of the employee's requests in the given statuses
// shares a day with startDate–endDate (any leave type).
const assertNoOverlap = async (
  { employeeId, startDate, endDate, excludeId },
  { statuses = ["Pending", "Approved"], transaction } = {},
) => {
  const where = {
    employeeId,
    status: { [Op.in]: statuses },
    startDate: { [Op.lte]: endDate },
    endDate: { [Op.gte]: startDate },
  };
  if (excludeId) {
    where.id = { [Op.ne]: excludeId };
  }

  const clash = await db.LeaveRequest.findOne({ where, order: [["startDate", "ASC"]], transaction });
  if (!clash) {
    return;
  }

  const range =
    clash.startDate === clash.endDate ? clash.startDate : `${clash.startDate} to ${clash.endDate}`;
  throw new AppError(
    `These dates overlap an existing ${clash.status.toLowerCase()} leave request (${range})`,
    409,
    "LEAVE_OVERLAP",
    [{ field: "startDate", message: `Overlaps ${range}` }],
  );
};

const plural = (n) => `${n} day${n === 1 ? "" : "s"}`;

const insufficientBalance = (year, requested, available) =>
  new AppError(
    `Insufficient leave balance for ${year}: ${plural(requested)} requested, ${plural(Math.max(0, available))} available`,
    400,
    "INSUFFICIENT_LEAVE_BALANCE",
    [{ field: "startDate", message: `Only ${plural(Math.max(0, available))} available in ${year}` }],
  );

// Working days of the employee's other pending requests of this type, per year.
const pendingDaysByYear = async ({ employeeId, leaveTypeId, years }, transaction) => {
  const pending = await db.LeaveRequest.findAll({
    where: {
      employeeId,
      leaveTypeId,
      status: "Pending",
      startDate: { [Op.lte]: `${Math.max(...years)}-12-31` },
      endDate: { [Op.gte]: `${Math.min(...years)}-01-01` },
    },
    attributes: ["id", "employeeId", "startDate", "endDate", "isHalfDay"],
    transaction,
  });
  const totals = {};
  for (const { byYear } of (await leaveDaysForMany(pending, { transaction })).values()) {
    for (const [year, days] of Object.entries(byYear)) {
      totals[year] = (totals[year] || 0) + days;
    }
  }
  return totals;
};

// At submit: each year's part must fit in that year's remaining balance of this
// type, after setting aside what is already pending.
const assertBalanceForSubmit = async ({ employeeId, leaveTypeId, byYear }, transaction) => {
  const years = Object.keys(byYear).map(Number);
  const [balances, pending] = await Promise.all([
    db.LeaveBalance.findAll({ where: { employeeId, leaveTypeId, year: years }, transaction }),
    pendingDaysByYear({ employeeId, leaveTypeId, years }, transaction),
  ]);
  for (const year of years) {
    const balance = balances.find((b) => b.year === year);
    const remaining = balance ? parseFloat(balance.totalDays) - parseFloat(balance.usedDays) : 0;
    const available = remaining - (pending[year] || 0);
    if (byYear[year] > available) {
      throw insufficientBalance(year, byYear[year], available);
    }
  }
};

// At approval: lock each year's balance, check all of them, then deduct each part
// from its own year. Returns what was deducted, for days_by_year.
const deductByYear = async ({ employeeId, leaveTypeId, byYear }, transaction) => {
  const parts = Object.entries(byYear).sort(([a], [b]) => a - b);
  const locked = [];
  for (const [year, days] of parts) {
    const balance = await lockBalance({ employeeId, leaveTypeId, year: Number(year) }, transaction, {
      create: true,
    });
    const remaining = parseFloat(balance.totalDays) - parseFloat(balance.usedDays);
    if (days > remaining) {
      throw insufficientBalance(year, days, remaining);
    }
    locked.push([balance, days]);
  }
  for (const [balance, days] of locked) {
    await balance.increment("usedDays", { by: days, transaction });
  }
  return Object.fromEntries(parts);
};

// What approval deducted before days_by_year existed: calendar days, all from the start year.
const legacyDeduction = ({ startDate, endDate, isHalfDay }) => ({
  [dayjs(startDate).year()]: isHalfDay ? 0.5 : dayjs(endDate).diff(dayjs(startDate), "day") + 1,
});

const sumDays = (byYear) => Object.values(byYear).reduce((sum, d) => sum + d, 0);

// Adds `days` and `daysByYear` to each request for display: what approval deducted
// when stored, otherwise the current working-day count.
const withLeaveDays = async (requests) => {
  const missing = requests.filter((r) => !r.daysByYear && r.status !== "Approved");
  const computed = await leaveDaysForMany(missing);
  return requests.map((r) => {
    const daysByYear =
      r.daysByYear ?? (r.status === "Approved" ? legacyDeduction(r) : computed.get(r.id).byYear);
    return { ...r.toJSON(), daysByYear, days: sumDays(daysByYear) };
  });
};

module.exports = {
  lockEmployee,
  assertNoOverlap,
  assertBalanceForSubmit,
  deductByYear,
  legacyDeduction,
  withLeaveDays,
};
