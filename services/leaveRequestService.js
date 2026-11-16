const db = require("../models");
const AppError = require("../utils/AppError");

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

module.exports = { lockEmployee, assertNoOverlap };
