const db = require("../models");

const toEntry = (employeeId, year, leaveType, balance) => {
  const totalDays = balance ? parseFloat(balance.totalDays) : 0;
  const usedDays = balance ? parseFloat(balance.usedDays) : 0;
  return {
    employeeId,
    year,
    leaveTypeId: leaveType.id,
    leaveTypeName: leaveType.name,
    totalDays,
    usedDays,
    remaining: totalDays - usedDays,
  };
};

// One entry per leave type for the employee and year; types without a row read as 0.
const listBalances = async (employeeId, year) => {
  const [types, balances] = await Promise.all([
    db.LeaveType.findAll({ attributes: ["id", "name"], order: [["name", "ASC"]] }),
    db.LeaveBalance.findAll({ where: { employeeId, year } }),
  ]);
  return types.map((type) =>
    toEntry(employeeId, year, type, balances.find((b) => b.leaveTypeId === type.id)),
  );
};

const balanceEntry = (balance, leaveType) =>
  toEntry(balance.employeeId, balance.year, leaveType, balance);

// Row-locks (SELECT … FOR UPDATE) the balance for one employee, type and year.
const lockBalance = async ({ employeeId, leaveTypeId, year }, transaction, { create = false } = {}) => {
  const where = { employeeId, leaveTypeId, year };
  if (create) {
    await db.LeaveBalance.findOrCreate({
      where,
      defaults: { totalDays: 0, usedDays: 0 },
      transaction,
    });
  }
  return db.LeaveBalance.findOne({ where, transaction, lock: transaction.LOCK.UPDATE });
};

module.exports = { listBalances, balanceEntry, lockBalance };
