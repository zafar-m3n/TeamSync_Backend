const AppError = require("../utils/AppError");
const { todayTz } = require("../utils/time");
const { revokeSessions } = require("./sessionService");

const EMPLOYMENT_STATUSES = ["Active", "Probation", "Suspended", "Resigned", "Terminated"];
const LEAVING_STATUSES = ["Resigned", "Terminated"];

// Suspended, or Resigned/Terminated whose termination date has arrived: no login.
const blocksAccess = ({ employmentStatus, terminationDate }, today = todayTz()) =>
  employmentStatus === "Suspended" ||
  (LEAVING_STATUSES.includes(employmentStatus) && terminationDate != null && terminationDate <= today);

// Merges the requested status/date onto the current ones and enforces the pairing:
// leaving statuses need a date, the others never carry one.
const resolveStatusFields = (current, body) => {
  const employmentStatus = body.employmentStatus ?? current.employmentStatus;

  if (!LEAVING_STATUSES.includes(employmentStatus)) {
    if (body.terminationDate) {
      throw new AppError(
        `A ${employmentStatus} employee cannot have a termination date`,
        400,
        "TERMINATION_DATE_NOT_ALLOWED",
      );
    }
    return { employmentStatus, terminationDate: null };
  }

  const terminationDate =
    body.terminationDate !== undefined ? body.terminationDate : current.terminationDate;
  if (!terminationDate) {
    throw new AppError(
      `A termination date is required when the status is ${employmentStatus}`,
      400,
      "TERMINATION_DATE_REQUIRED",
    );
  }
  const joined = body.dateOfJoining !== undefined ? body.dateOfJoining : current.dateOfJoining;
  if (joined && terminationDate < joined) {
    throw new AppError(
      "Termination date cannot be before the date of joining",
      400,
      "TERMINATION_BEFORE_JOINING",
    );
  }
  return { employmentStatus, terminationDate };
};

// Brings the linked user's login in line with the employee's status: blocked
// statuses deactivate and revoke sessions; leaving a blocked state re-enables.
const syncUserAccess = async (employee, user, { wasBlocked }, transaction) => {
  const blocked = blocksAccess(employee);
  if (blocked && user.isActive) {
    await user.update({ isActive: false }, { transaction });
    await revokeSessions(user.id, { transaction });
  } else if (!blocked && wasBlocked && !user.isActive) {
    await user.update({ isActive: true }, { transaction });
  }
};

// Daily: deactivates users whose future-dated termination has now arrived.
const applyDueTerminations = async () => {
  const db = require("../models");
  const { Op } = db.Sequelize;
  const due = await db.Employee.findAll({
    where: {
      employmentStatus: { [Op.in]: LEAVING_STATUSES },
      terminationDate: { [Op.lte]: todayTz() },
    },
    include: { association: "user", where: { isActive: true } },
  });
  for (const employee of due) {
    await db.sequelize.transaction((t) =>
      syncUserAccess(employee, employee.user, { wasBlocked: false }, t),
    );
  }
  return due.length;
};

// List filter values: "current" (default) hides people whose leaving date has passed.
const statusFilter = (value, Op, today = todayTz()) => {
  const former = {
    employmentStatus: { [Op.in]: LEAVING_STATUSES },
    terminationDate: { [Op.lte]: today },
  };
  if (value === undefined || value === "current") {
    return { [Op.not]: former };
  }
  if (value === "former") {
    return former;
  }
  if (value === "all") {
    return {};
  }
  if (EMPLOYMENT_STATUSES.includes(value)) {
    return { employmentStatus: value };
  }
  throw new AppError("Unknown employment status filter", 400, "VALIDATION_ERROR");
};

module.exports = {
  EMPLOYMENT_STATUSES,
  LEAVING_STATUSES,
  blocksAccess,
  resolveStatusFields,
  syncUserAccess,
  applyDueTerminations,
  statusFilter,
};
