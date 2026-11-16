const db = require("../models");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");
const hasPermission = require("../utils/hasPermission");
const { getRequesterEmployee } = require("../services/requesterService");
const { nowTz } = require("../utils/time");
const { listBalances, balanceEntry, lockBalance } = require("../services/leaveBalanceService");

const currentYear = () => nowTz().year();

const resolveYear = (query) => {
  const parsed = parseInt(query.year, 10);
  return Number.isNaN(parsed) ? currentYear() : parsed;
};

const setLeaveBalance = catchAsync(async (req, res) => {
  const { employeeId, year, leaveTypeId } = req.params;
  const { totalDays } = req.body;

  const employee = await db.Employee.findByPk(employeeId);
  if (!employee) {
    throw new AppError("Employee not found", 404, "NOT_FOUND");
  }

  const leaveType = await db.LeaveType.findByPk(leaveTypeId);
  if (!leaveType) {
    throw new AppError("Leave type not found", 404, "LEAVE_TYPE_NOT_FOUND");
  }

  const balance = await db.sequelize.transaction(async (t) => {
    const locked = await lockBalance({ employeeId, leaveTypeId, year }, t, { create: true });
    const usedDays = parseFloat(locked.usedDays);
    if (totalDays < usedDays) {
      throw new AppError(
        `Total days cannot be below the ${usedDays} day(s) already used`,
        400,
        "TOTAL_BELOW_USED",
        [{ field: "totalDays", message: `Must be at least ${usedDays} (already used)` }],
      );
    }
    return locked.update({ totalDays }, { transaction: t });
  });

  return sendSuccess(res, 200, balanceEntry(balance, leaveType));
});

const getMyLeaveBalance = catchAsync(async (req, res) => {
  const requester = await getRequesterEmployee(req);

  const year = resolveYear(req.query);
  const payload = await listBalances(requester.id, year);
  return sendSuccess(res, 200, payload);
});

const getEmployeeLeaveBalance = catchAsync(async (req, res) => {
  const target = await db.Employee.findByPk(req.params.employeeId);
  if (!target) {
    throw new AppError("Employee not found", 404, "NOT_FOUND");
  }

  const year = resolveYear(req.query);

  const canViewAll = await hasPermission(req.user.roleId, "leave", "view_all");
  if (canViewAll) {
    return sendSuccess(res, 200, await listBalances(target.id, year));
  }

  const requester = await getRequesterEmployee(req, { required: false });

  const canViewTeam = await hasPermission(req.user.roleId, "leave", "view_team");
  if (canViewTeam && requester && target.managerId === requester.id) {
    return sendSuccess(res, 200, await listBalances(target.id, year));
  }

  const canViewOwn = await hasPermission(req.user.roleId, "leave", "view_own");
  if (canViewOwn && requester && target.id === requester.id) {
    return sendSuccess(res, 200, await listBalances(target.id, year));
  }

  throw new AppError("You do not have permission to view this leave balance", 403, "FORBIDDEN");
});

module.exports = { setLeaveBalance, getMyLeaveBalance, getEmployeeLeaveBalance };
