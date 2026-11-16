const db = require("../models");
const { Op } = db.Sequelize;
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const hasPermission = require("../utils/hasPermission");
const { getRequesterEmployee } = require("../services/requesterService");
const { todayTz } = require("../utils/time");
const { buildDateFilter } = require("../utils/queryHelpers");
const { clockIn, clockOut, clockStatus } = require("../services/attendanceService");

const clockInMe = catchAsync(async (req, res) => {
  const requester = await getRequesterEmployee(req);
  return sendSuccess(res, 201, await clockIn(requester.id));
});

const clockOutMe = catchAsync(async (req, res) => {
  const requester = await getRequesterEmployee(req);
  return sendSuccess(res, 200, await clockOut(requester.id));
});

const getMyClockStatus = catchAsync(async (req, res) => {
  const requester = await getRequesterEmployee(req);
  return sendSuccess(res, 200, await clockStatus(requester.id));
});

const getMyAttendance = catchAsync(async (req, res) => {
  const requester = await getRequesterEmployee(req);

  const { page, limit, offset } = parsePagination(req.query);

  const where = { employeeId: requester.id };
  const dateFilter = buildDateFilter(req.query);
  if (dateFilter) {
    where.date = dateFilter;
  }

  const { rows, count } = await db.AttendanceRecord.findAndCountAll({
    where,
    order: [["date", "DESC"]],
    limit,
    offset,
  });

  return sendSuccess(res, 200, rows, buildPaginationMeta(page, limit, count));
});

const getTeamAttendance = catchAsync(async (req, res) => {
  const requester = await getRequesterEmployee(req);

  const reports = await db.Employee.findAll({
    where: { managerId: requester.id },
    attributes: ["id"],
  });
  const reportIds = reports.map((r) => r.id);

  const date = req.query.date || todayTz();

  const records = await db.AttendanceRecord.findAll({
    where: { employeeId: { [Op.in]: reportIds }, date },
    include: "employee",
  });

  return sendSuccess(res, 200, records);
});

const listAllAttendance = catchAsync(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);

  const where = {};
  if (req.query.employeeId !== undefined) {
    where.employeeId = req.query.employeeId;
  }
  if (req.query.status !== undefined) {
    where.status = req.query.status;
  }
  const dateFilter = buildDateFilter(req.query);
  if (dateFilter) {
    where.date = dateFilter;
  }

  const employeeInclude = { association: "employee" };
  if (req.query.departmentId !== undefined) {
    employeeInclude.where = { departmentId: req.query.departmentId };
    employeeInclude.required = true;
  }

  const { rows, count } = await db.AttendanceRecord.findAndCountAll({
    where,
    include: [employeeInclude],
    order: [["date", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  return sendSuccess(res, 200, rows, buildPaginationMeta(page, limit, count));
});

const updateAttendance = catchAsync(async (req, res) => {
  const record = await db.AttendanceRecord.findByPk(req.params.id);
  if (!record) {
    throw new AppError("Attendance record not found", 404, "NOT_FOUND");
  }

  const { clockIn, clockOut, status } = req.body;
  const patch = { isManualOverride: true, overriddenBy: req.user.id };
  if (clockIn !== undefined) {
    patch.clockIn = clockIn;
  }
  if (clockOut !== undefined) {
    patch.clockOut = clockOut;
  }
  if (status !== undefined) {
    patch.status = status;
  }

  await record.update(patch);
  return sendSuccess(res, 200, record);
});

// Nobody overrides their own record; attendance:view_all holders may override anyone
// else, everyone else only their direct reports.
const assertCanOverride = async (req, record) => {
  const requester = await getRequesterEmployee(req, { required: false });

  if (requester && record.employeeId === requester.id) {
    throw new AppError("You cannot override your own attendance", 403, "CANNOT_OVERRIDE_OWN_RECORD");
  }

  if (await hasPermission(req.user.roleId, "attendance", "view_all")) {
    return;
  }

  const employee = await db.Employee.findByPk(record.employeeId, { attributes: ["id", "managerId"] });
  if (!requester || !employee || employee.managerId !== requester.id) {
    throw new AppError("This employee is not your direct report", 403, "NOT_YOUR_DIRECT_REPORT");
  }
};

const overrideAttendance = catchAsync(async (req, res) => {
  const record = await db.AttendanceRecord.findByPk(req.params.id);
  if (!record) {
    throw new AppError("Attendance record not found", 404, "NOT_FOUND");
  }

  await assertCanOverride(req, record);

  if (record.status !== "Absent") {
    throw new AppError("Only an Absent record can be corrected through this endpoint", 400, "NOT_ABSENT");
  }

  await record.update({
    status: req.body.status,
    isManualOverride: true,
    overriddenBy: req.user.id,
  });

  return sendSuccess(res, 200, record);
});

module.exports = {
  clockInMe,
  clockOutMe,
  getMyClockStatus,
  getMyAttendance,
  getTeamAttendance,
  listAllAttendance,
  updateAttendance,
  overrideAttendance,
};
