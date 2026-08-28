const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const db = require("../models");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");
const hasPermission = require("../utils/hasPermission");

const TZ = process.env.NODE_TEAMSYNC_APP_TIMEZONE || "UTC";

const currentYear = () => dayjs().tz(TZ).year();

const resolveYear = (query) => {
  const parsed = parseInt(query.year, 10);
  return Number.isNaN(parsed) ? currentYear() : parsed;
};

const loadBalancePayload = async (employeeId, year) => {
  const balance = await db.LeaveBalance.findOne({ where: { employeeId, year } });
  if (!balance) {
    return { employeeId, year, totalDays: 0, usedDays: 0, remaining: 0 };
  }
  const plain = balance.toJSON();
  const remaining = parseFloat(plain.totalDays) - parseFloat(plain.usedDays);
  return { ...plain, remaining };
};

const setLeaveBalance = catchAsync(async (req, res) => {
  const { employeeId, year } = req.params;
  const { totalDays } = req.body;

  const employee = await db.Employee.findByPk(employeeId);
  if (!employee) {
    throw new AppError("Employee not found", 404, "NOT_FOUND");
  }

  const [balance, created] = await db.LeaveBalance.findOrCreate({
    where: { employeeId, year },
    defaults: { totalDays, usedDays: 0 },
  });

  if (!created) {
    await balance.update({ totalDays });
  }

  return sendSuccess(res, 200, balance);
});

const getMyLeaveBalance = catchAsync(async (req, res) => {
  const requester = await db.Employee.findOne({ where: { userId: req.user.id } });
  if (!requester) {
    throw new AppError("No employee profile linked to this account", 404, "NO_EMPLOYEE_PROFILE");
  }

  const year = resolveYear(req.query);
  const payload = await loadBalancePayload(requester.id, year);
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
    return sendSuccess(res, 200, await loadBalancePayload(target.id, year));
  }

  const requester = await db.Employee.findOne({ where: { userId: req.user.id } });

  const canViewTeam = await hasPermission(req.user.roleId, "leave", "view_team");
  if (canViewTeam && requester && target.managerId === requester.id) {
    return sendSuccess(res, 200, await loadBalancePayload(target.id, year));
  }

  const canViewOwn = await hasPermission(req.user.roleId, "leave", "view_own");
  if (canViewOwn && requester && target.id === requester.id) {
    return sendSuccess(res, 200, await loadBalancePayload(target.id, year));
  }

  throw new AppError("You do not have permission to view this leave balance", 403, "FORBIDDEN");
});

module.exports = { setLeaveBalance, getMyLeaveBalance, getEmployeeLeaveBalance };
