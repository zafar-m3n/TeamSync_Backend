const db = require("../models");
const { Op } = db.Sequelize;
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const hasPermission = require("../utils/hasPermission");
const { markHalfDay } = require("../services/attendanceService");
const { getRequesterEmployee } = require("../services/requesterService");
const { lockBalance } = require("../services/leaveBalanceService");
const {
  lockEmployee,
  assertNoOverlap,
  assertBalanceForSubmit,
  deductByYear,
  legacyDeduction,
  withLeaveDays,
} = require("../services/leaveRequestService");
const { leaveDaysFor } = require("../services/workingDayService");
const { afterResponse, notifyLeaveSubmitted } = require("../services/notificationService");
const { buildDateFilter } = require("../utils/queryHelpers");

const requireWorkingDays = (days) => {
  if (days.total === 0) {
    throw new AppError(
      "The selected dates contain no working days",
      400,
      "NO_WORKING_DAYS",
      [{ field: "startDate", message: "No working days in this range" }],
    );
  }
  return days;
};

// Approve/reject always needs leave:approve and never applies to your own request.
// leave:view_all holders may act on anyone else's; others only on direct reports'.
const assertCanActOnRequest = async (req, request) => {
  if (!(await hasPermission(req.user.roleId, "leave", "approve"))) {
    throw new AppError("You do not have permission to act on this leave request", 403, "FORBIDDEN");
  }

  if (request.employee && request.employee.userId === req.user.id) {
    throw new AppError("You cannot act on your own leave request", 403, "CANNOT_ACT_ON_OWN_REQUEST");
  }

  if (await hasPermission(req.user.roleId, "leave", "view_all")) {
    return;
  }

  const requester = await getRequesterEmployee(req, { required: false });
  if (requester && request.employee && request.employee.managerId === requester.id) {
    return;
  }

  throw new AppError("You do not have permission to act on this leave request", 403, "FORBIDDEN");
};

const createLeaveRequest = catchAsync(async (req, res) => {
  const requester = await getRequesterEmployee(req);

  const { leaveTypeId, startDate, endDate, isHalfDay } = req.body;

  const leaveType = await db.LeaveType.findByPk(leaveTypeId);
  if (!leaveType) {
    throw new AppError("Leave type not found", 404, "LEAVE_TYPE_NOT_FOUND");
  }

  const request = await db.sequelize.transaction(async (t) => {
    await lockEmployee(requester.id, t);
    await assertNoOverlap({ employeeId: requester.id, startDate, endDate }, { transaction: t });
    const { byYear } = requireWorkingDays(
      await leaveDaysFor(requester.id, { startDate, endDate, isHalfDay }, { transaction: t }),
    );
    await assertBalanceForSubmit({ employeeId: requester.id, leaveTypeId, byYear }, t);
    return db.LeaveRequest.create(
      { employeeId: requester.id, leaveTypeId, startDate, endDate, isHalfDay, status: "Pending" },
      { transaction: t },
    );
  });

  afterResponse(res, () => notifyLeaveSubmitted(request.id));
  return sendSuccess(res, 201, request);
});

// Working days the requester's leave range would cost, for the request form.
const previewLeaveDays = catchAsync(async (req, res) => {
  const requester = await getRequesterEmployee(req);
  const days = await leaveDaysFor(requester.id, req.validatedQuery);
  return sendSuccess(res, 200, { days: days.total, byYear: days.byYear });
});

const getMyLeaveRequests = catchAsync(async (req, res) => {
  const requester = await getRequesterEmployee(req);

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

  return sendSuccess(res, 200, await withLeaveDays(rows), buildPaginationMeta(page, limit, count));
});

const getTeamLeaveRequests = catchAsync(async (req, res) => {
  const requester = await getRequesterEmployee(req);

  const reports = await db.Employee.findAll({
    where: { managerId: requester.id },
    attributes: ["id"],
  });
  const reportIds = reports.map((r) => r.id);

  const query = req.validatedQuery;
  const { page, limit, offset } = parsePagination(query);
  const where = { employeeId: { [Op.in]: reportIds } };
  if (query.status !== undefined) {
    where.status = query.status;
  }
  const dateFilter = buildDateFilter(query);
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

  return sendSuccess(res, 200, await withLeaveDays(rows), buildPaginationMeta(page, limit, count));
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

  return sendSuccess(res, 200, await withLeaveDays(rows), buildPaginationMeta(page, limit, count));
});

// Re-reads the request with a row lock (SELECT … FOR UPDATE) so concurrent state
// changes on it are serialized, then checks it is still in the expected status.
const lockRequest = async (id, transaction, expectedStatus, error) => {
  const locked = await db.LeaveRequest.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
  if (!locked || locked.status !== expectedStatus) {
    throw error;
  }
  return locked;
};

const approveLeaveRequest = catchAsync(async (req, res) => {
  const request = await db.LeaveRequest.findByPk(req.params.id, { include: "employee" });
  if (!request) {
    throw new AppError("Leave request not found", 404, "NOT_FOUND");
  }

  await assertCanActOnRequest(req, request);

  const approved = await db.sequelize.transaction(async (t) => {
    const locked = await lockRequest(
      request.id,
      t,
      "Pending",
      new AppError("Only a pending request can be approved", 400, "NOT_PENDING"),
    );

    // Older overlapping pending requests may exist; only one of them can be approved.
    await lockEmployee(locked.employeeId, t);
    await assertNoOverlap(
      { ...locked.get({ plain: true }), excludeId: locked.id },
      { statuses: ["Approved"], transaction: t },
    );

    const { byYear } = requireWorkingDays(
      await leaveDaysFor(locked.employeeId, locked, { transaction: t }),
    );
    const daysByYear = await deductByYear(
      { employeeId: locked.employeeId, leaveTypeId: locked.leaveTypeId, byYear },
      t,
    );
    await locked.update(
      {
        status: "Approved",
        approvedBy: req.user.id,
        actedAt: new Date(),
        daysByYear,
      },
      { transaction: t },
    );

    if (locked.isHalfDay) {
      await markHalfDay(locked.employeeId, locked.startDate, { transaction: t });
    }

    return locked;
  });

  return sendSuccess(res, 200, approved);
});

const rejectLeaveRequest = catchAsync(async (req, res) => {
  const request = await db.LeaveRequest.findByPk(req.params.id, { include: "employee" });
  if (!request) {
    throw new AppError("Leave request not found", 404, "NOT_FOUND");
  }

  await assertCanActOnRequest(req, request);

  const rejected = await db.sequelize.transaction(async (t) => {
    const locked = await lockRequest(
      request.id,
      t,
      "Pending",
      new AppError("Only a pending request can be rejected", 400, "NOT_PENDING"),
    );
    await locked.update(
      { status: "Rejected", approvedBy: req.user.id, actedAt: new Date() },
      { transaction: t },
    );
    return locked;
  });

  return sendSuccess(res, 200, rejected);
});

const cancelLeaveRequest = catchAsync(async (req, res) => {
  const request = await db.LeaveRequest.findByPk(req.params.id, { include: "employee" });
  if (!request) {
    throw new AppError("Leave request not found", 404, "NOT_FOUND");
  }

  const requester = await getRequesterEmployee(req, { required: false });
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

    const cancelled = await db.sequelize.transaction(async (t) => {
      const locked = await lockRequest(
        request.id,
        t,
        "Pending",
        new AppError("This request is no longer pending", 400, "NOT_PENDING"),
      );
      await locked.update({ status: "Cancelled" }, { transaction: t });
      return locked;
    });

    return sendSuccess(res, 200, cancelled);
  }

  if (request.status === "Approved") {
    const canCancelApproved = await hasPermission(req.user.roleId, "leave", "cancel_approved");
    const canActBroadly = await hasPermission(req.user.roleId, "leave", "view_all");

    if (!(canCancelApproved && (canActBroadly || isManagerOfTarget))) {
      throw new AppError("You do not have permission to cancel this leave request", 403, "FORBIDDEN");
    }

    const cancelled = await db.sequelize.transaction(async (t) => {
      const locked = await lockRequest(
        request.id,
        t,
        "Approved",
        new AppError("This request is already in a final state", 400, "CANNOT_CANCEL"),
      );

      // Refund exactly what approval deducted, year by year.
      const deducted = locked.daysByYear ?? legacyDeduction(locked);
      for (const [year, days] of Object.entries(deducted)) {
        const balance = await lockBalance(
          { employeeId: locked.employeeId, leaveTypeId: locked.leaveTypeId, year: Number(year) },
          t,
        );
        if (balance) {
          const usedDays = Math.max(0, parseFloat(balance.usedDays) - days);
          await balance.update({ usedDays }, { transaction: t });
        }
      }
      await locked.update({ status: "Cancelled" }, { transaction: t });

      return locked;
    });

    return sendSuccess(res, 200, cancelled);
  }

  throw new AppError("This request is already in a final state", 400, "CANNOT_CANCEL");
});

module.exports = {
  createLeaveRequest,
  previewLeaveDays,
  getMyLeaveRequests,
  getTeamLeaveRequests,
  listAllLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
};
