const dayjs = require("dayjs");

const db = require("../models");
const { Op } = db.Sequelize;
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const hasPermission = require("../utils/hasPermission");
const { markHalfDay } = require("../services/attendanceService");

const computeDays = (startDate, endDate, isHalfDay) => {
  if (isHalfDay) {
    return 0.5;
  }
  return dayjs(endDate).diff(dayjs(startDate), "day") + 1;
};

const buildDateFilter = (query) => {
  if (query.startDate && query.endDate) {
    return { [Op.between]: [query.startDate, query.endDate] };
  }
  if (query.startDate) {
    return { [Op.gte]: query.startDate };
  }
  if (query.endDate) {
    return { [Op.lte]: query.endDate };
  }
  return undefined;
};

// HR/Admin (leave:view_all) can act on any request; a Manager with leave:approve
// can act only on their own direct reports' requests.
const assertCanActOnRequest = async (req, request) => {
  const canActBroadly = await hasPermission(req.user.roleId, "leave", "view_all");
  if (canActBroadly) {
    return;
  }

  const canApprove = await hasPermission(req.user.roleId, "leave", "approve");
  const requester = await db.Employee.findOne({ where: { userId: req.user.id } });

  if (canApprove && requester && request.employee && request.employee.managerId === requester.id) {
    return;
  }

  throw new AppError("You do not have permission to act on this leave request", 403, "FORBIDDEN");
};

const createLeaveRequest = catchAsync(async (req, res) => {
  const requester = await db.Employee.findOne({ where: { userId: req.user.id } });
  if (!requester) {
    throw new AppError("No employee profile linked to this account", 404, "NO_EMPLOYEE_PROFILE");
  }

  const { leaveTypeId, startDate, endDate, isHalfDay } = req.body;

  const leaveType = await db.LeaveType.findByPk(leaveTypeId);
  if (!leaveType) {
    throw new AppError("Leave type not found", 404, "LEAVE_TYPE_NOT_FOUND");
  }

  const request = await db.LeaveRequest.create({
    employeeId: requester.id,
    leaveTypeId,
    startDate,
    endDate,
    isHalfDay,
    status: "Pending",
  });

  return sendSuccess(res, 201, request);
});

const getMyLeaveRequests = catchAsync(async (req, res) => {
  const requester = await db.Employee.findOne({ where: { userId: req.user.id } });
  if (!requester) {
    throw new AppError("No employee profile linked to this account", 404, "NO_EMPLOYEE_PROFILE");
  }

  const { page, limit, offset } = parsePagination(req.query);

  const where = { employeeId: requester.id };
  if (req.query.status !== undefined) {
    where.status = req.query.status;
  }

  const { rows, count } = await db.LeaveRequest.findAndCountAll({
    where,
    include: "leaveType",
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });

  return sendSuccess(res, 200, rows, buildPaginationMeta(page, limit, count));
});

const getTeamLeaveRequests = catchAsync(async (req, res) => {
  const requester = await db.Employee.findOne({ where: { userId: req.user.id } });
  if (!requester) {
    throw new AppError("No employee profile linked to this account", 404, "NO_EMPLOYEE_PROFILE");
  }

  const reports = await db.Employee.findAll({
    where: { managerId: requester.id },
    attributes: ["id"],
  });
  const reportIds = reports.map((r) => r.id);

  const where = { employeeId: { [Op.in]: reportIds } };
  if (req.query.status !== undefined) {
    where.status = req.query.status;
  }

  const records = await db.LeaveRequest.findAll({
    where,
    include: ["employee", "leaveType"],
    order: [["createdAt", "DESC"]],
  });

  return sendSuccess(res, 200, records);
});

const listAllLeaveRequests = catchAsync(async (req, res) => {
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
    where.startDate = dateFilter;
  }

  const { rows, count } = await db.LeaveRequest.findAndCountAll({
    where,
    include: ["employee", "leaveType"],
    order: [["createdAt", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  return sendSuccess(res, 200, rows, buildPaginationMeta(page, limit, count));
});

const approveLeaveRequest = catchAsync(async (req, res) => {
  const request = await db.LeaveRequest.findByPk(req.params.id, { include: "employee" });
  if (!request) {
    throw new AppError("Leave request not found", 404, "NOT_FOUND");
  }

  if (request.status !== "Pending") {
    throw new AppError("Only a pending request can be approved", 400, "NOT_PENDING");
  }

  await assertCanActOnRequest(req, request);

  const daysRequested = computeDays(request.startDate, request.endDate, request.isHalfDay);
  const year = dayjs(request.startDate).year();

  const [balance] = await db.LeaveBalance.findOrCreate({
    where: { employeeId: request.employeeId, year },
    defaults: { totalDays: 0, usedDays: 0 },
  });

  const remaining = parseFloat(balance.totalDays) - parseFloat(balance.usedDays);
  if (daysRequested > remaining) {
    throw new AppError("Insufficient leave balance", 400, "INSUFFICIENT_LEAVE_BALANCE");
  }

  await db.sequelize.transaction(async (t) => {
    await balance.increment("usedDays", { by: daysRequested, transaction: t });
    await request.update(
      { status: "Approved", approvedBy: req.user.id, actedAt: new Date() },
      { transaction: t },
    );
  });

  if (request.isHalfDay) {
    try {
      await markHalfDay(request.employeeId, request.startDate);
    } catch (err) {
      require("../utils/logger").error(
        `markHalfDay failed for leave request ${request.id}: ${err.message}`,
      );
    }
  }

  return sendSuccess(res, 200, request);
});

const rejectLeaveRequest = catchAsync(async (req, res) => {
  const request = await db.LeaveRequest.findByPk(req.params.id, { include: "employee" });
  if (!request) {
    throw new AppError("Leave request not found", 404, "NOT_FOUND");
  }

  if (request.status !== "Pending") {
    throw new AppError("Only a pending request can be rejected", 400, "NOT_PENDING");
  }

  await assertCanActOnRequest(req, request);

  await request.update({ status: "Rejected", approvedBy: req.user.id, actedAt: new Date() });

  return sendSuccess(res, 200, request);
});

const cancelLeaveRequest = catchAsync(async (req, res) => {
  const request = await db.LeaveRequest.findByPk(req.params.id, { include: "employee" });
  if (!request) {
    throw new AppError("Leave request not found", 404, "NOT_FOUND");
  }

  const requester = await db.Employee.findOne({ where: { userId: req.user.id } });
  const isManagerOfTarget = !!(
    requester &&
    request.employee &&
    request.employee.managerId === requester.id
  );

  if (request.status === "Pending") {
    const canCancelPending = await hasPermission(req.user.roleId, "leave", "cancel_pending");
    const isOwner = request.employee && request.employee.userId === req.user.id;

    if (isOwner && canCancelPending) {
      // self-cancel
    } else {
      const canActBroadly = await hasPermission(req.user.roleId, "leave", "view_all");
      if (!(canCancelPending && (canActBroadly || isManagerOfTarget))) {
        throw new AppError("You do not have permission to cancel this leave request", 403, "FORBIDDEN");
      }
    }

    await request.update({ status: "Cancelled" });
    return sendSuccess(res, 200, request);
  }

  if (request.status === "Approved") {
    const canCancelApproved = await hasPermission(req.user.roleId, "leave", "cancel_approved");
    const canActBroadly = await hasPermission(req.user.roleId, "leave", "view_all");

    if (!(canCancelApproved && (canActBroadly || isManagerOfTarget))) {
      throw new AppError("You do not have permission to cancel this leave request", 403, "FORBIDDEN");
    }

    const daysRequested = computeDays(request.startDate, request.endDate, request.isHalfDay);
    const year = dayjs(request.startDate).year();

    await db.sequelize.transaction(async (t) => {
      await request.update({ status: "Cancelled" }, { transaction: t });

      const balance = await db.LeaveBalance.findOne({
        where: { employeeId: request.employeeId, year },
        transaction: t,
      });
      if (balance) {
        const refunded = Math.max(0, parseFloat(balance.usedDays) - daysRequested);
        await balance.update({ usedDays: refunded }, { transaction: t });
      }
    });

    return sendSuccess(res, 200, request);
  }

  throw new AppError("This request is already in a final state", 400, "CANNOT_CANCEL");
});

module.exports = {
  createLeaveRequest,
  getMyLeaveRequests,
  getTeamLeaveRequests,
  listAllLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
};
