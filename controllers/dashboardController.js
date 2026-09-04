const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const db = require("../models");
const { Op, fn, col } = db.Sequelize;
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");
const hasPermission = require("../utils/hasPermission");

const TZ = process.env.NODE_TEAMSYNC_APP_TIMEZONE || "UTC";

const today = () => dayjs().tz(TZ).format("YYYY-MM-DD");
const currentYear = () => dayjs().tz(TZ).year();
const monthRange = () => {
  const now = dayjs().tz(TZ);
  return [now.startOf("month").format("YYYY-MM-DD"), now.endOf("month").format("YYYY-MM-DD")];
};

// Percentage of attendance records in [startDate, endDate] where someone showed up
// (Present or Late). Denominator is every record that exists in the window; employees
// with no shift never generate a record, so they drop out of both sides automatically.
const attendanceRate = async (startDate, endDate) => {
  const totalRecords = await db.AttendanceRecord.count({ where: { date: { [Op.between]: [startDate, endDate] } } });
  if (totalRecords === 0) return 0;
  const attendedRecords = await db.AttendanceRecord.count({
    where: { date: { [Op.between]: [startDate, endDate] }, status: { [Op.in]: ["Present", "Late"] } },
  });
  return Math.round((attendedRecords / totalRecords) * 10000) / 100;
};

// "assigned to this employee" — direct assignment, or one to their department
// (only when they actually have a department). Mirrors Phase 10's getAssignedToMe.
const assignmentScopeOr = (employee) => {
  const conds = [{ employeeId: employee.id }];
  if (employee.departmentId != null) {
    conds.push({ departmentId: employee.departmentId });
  }
  return { [Op.or]: conds };
};

const buildLeaveBalance = async (employeeId) => {
  const balance = await db.LeaveBalance.findOne({ where: { employeeId, year: currentYear() } });
  if (!balance) {
    return { totalDays: 0, usedDays: 0, remaining: 0 };
  }
  return {
    totalDays: balance.totalDays,
    usedDays: balance.usedDays,
    remaining: parseFloat(balance.totalDays) - parseFloat(balance.usedDays),
  };
};

const buildAssignedTraining = async (employee) => {
  const assignments = await db.TrainingAssignment.findAll({
    where: assignmentScopeOr(employee),
    include: { association: "document", include: "category" },
    order: [["createdAt", "DESC"]],
  });

  const seen = new Set();
  const documents = [];
  for (const assignment of assignments) {
    const doc = assignment.document;
    if (doc && !seen.has(doc.id)) {
      seen.add(doc.id);
      documents.push(doc);
    }
  }

  return { count: documents.length, recent: documents.slice(0, 5) };
};

const employeeDashboard = async (req, res) => {
  const requester = await db.Employee.findOne({ where: { userId: req.user.id } });

  if (!requester) {
    return sendSuccess(res, 200, {
      clockInStatus: { hasClockedIn: false },
      leaveBalance: { totalDays: 0, usedDays: 0, remaining: 0 },
      assignedTraining: { count: 0, recent: [] },
      goalProgress: [],
    });
  }

  const attendance = await db.AttendanceRecord.findOne({
    where: { employeeId: requester.id, date: today() },
  });
  const clockInStatus = attendance
    ? { hasClockedIn: true, status: attendance.status, clockIn: attendance.clockIn }
    : { hasClockedIn: false };

  const leaveBalance = await buildLeaveBalance(requester.id);
  const assignedTraining = await buildAssignedTraining(requester);

  const [monthStart, monthEnd] = monthRange();
  const goalProgress = await db.Goal.findAll({
    where: { employeeId: requester.id, targetDate: { [Op.between]: [monthStart, monthEnd] } },
    order: [["targetDate", "ASC"]],
  });

  return sendSuccess(res, 200, { clockInStatus, leaveBalance, assignedTraining, goalProgress });
};

const managerDashboard = async (req, res) => {
  const requester = await db.Employee.findOne({ where: { userId: req.user.id } });
  if (!requester) {
    throw new AppError("No employee profile linked to this account", 404, "NO_EMPLOYEE_PROFILE");
  }

  const reports = await db.Employee.findAll({
    where: { managerId: requester.id },
    attributes: ["id"],
  });
  const reportIds = reports.map((r) => r.id);

  const teamAttendanceToday = await db.AttendanceRecord.findAll({
    where: { employeeId: { [Op.in]: reportIds }, date: today() },
    include: { association: "employee", attributes: ["id", "fullName", "employeeCode"] },
  });

  const pendingLeaveApprovals = await db.LeaveRequest.findAll({
    where: { employeeId: { [Op.in]: reportIds }, status: "Pending" },
    include: ["employee", "leaveType"],
    order: [["createdAt", "ASC"]],
  });

  const [monthStart, monthEnd] = monthRange();
  const teamGoalProgress = await db.Goal.findAll({
    where: { employeeId: { [Op.in]: reportIds }, targetDate: { [Op.between]: [monthStart, monthEnd] } },
    include: "employee",
    order: [["targetDate", "ASC"]],
  });

  return sendSuccess(res, 200, { teamAttendanceToday, pendingLeaveApprovals, teamGoalProgress });
};

const adminDashboard = async (req, res) => {
  const orgAttendanceSnapshot = await db.AttendanceRecord.findAll({
    where: { date: today() },
    attributes: ["status", [fn("COUNT", col("id")), "count"]],
    group: ["status"],
  });

  const pendingItems = await db.LeaveRequest.findAll({
    where: { status: "Pending" },
    include: ["employee", "leaveType"],
    limit: 10,
    order: [["createdAt", "ASC"]],
  });
  const pendingTotal = await db.LeaveRequest.count({ where: { status: "Pending" } });

  const employeeCountByDepartment = await db.Employee.findAll({
    attributes: ["departmentId", [fn("COUNT", col("Employee.id")), "count"]],
    group: ["departmentId"],
    include: "department",
  });

  const [recentEmployees, recentLeaveRequests, recentTrainingAssignments] = await Promise.all([
    db.Employee.findAll({
      attributes: ["id", "fullName", "employeeCode", "createdAt"],
      order: [["createdAt", "DESC"]],
      limit: 5,
    }),
    db.LeaveRequest.findAll({
      include: [
        { association: "employee", attributes: ["id", "fullName"] },
        { association: "leaveType", attributes: ["id", "name"] },
      ],
      order: [["createdAt", "DESC"]],
      limit: 5,
    }),
    db.TrainingAssignment.findAll({
      include: [
        { association: "document", attributes: ["id", "title"] },
        { association: "employee", attributes: ["id", "fullName"] },
        { association: "department", attributes: ["id", "name"] },
      ],
      order: [["createdAt", "DESC"]],
      limit: 5,
    }),
  ]);

  const recentActivityFeed = [
    ...recentEmployees.map((e) => ({
      type: "employee_created",
      timestamp: e.createdAt,
      data: { id: e.id, fullName: e.fullName, employeeCode: e.employeeCode },
    })),
    ...recentLeaveRequests.map((lr) => ({
      type: "leave_requested",
      timestamp: lr.createdAt,
      data: {
        id: lr.id,
        status: lr.status,
        startDate: lr.startDate,
        endDate: lr.endDate,
        employee: lr.employee,
        leaveType: lr.leaveType,
      },
    })),
    ...recentTrainingAssignments.map((ta) => ({
      type: "training_assigned",
      timestamp: ta.createdAt,
      data: {
        id: ta.id,
        document: ta.document,
        employee: ta.employee,
        department: ta.department,
      },
    })),
  ]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 10);

  const weeklyStart = dayjs().tz(TZ).subtract(6, "day").format("YYYY-MM-DD");
  const monthlyStart = dayjs().tz(TZ).startOf("month").format("YYYY-MM-DD");
  const todayStr = today();

  // System (Admin) vs Workforce (HR) is chosen by the 'permissions'/'manage' permission (Admin-only today), not a hardcoded roleName, to match how the rest of the app gates access.
  const canManagePermissions = await hasPermission(req.user.roleId, "permissions", "manage");

  let system;
  let workforce;

  if (canManagePermissions) {
    system = {
      totalUsers: await db.User.count(),
      inactiveUsers: await db.User.count({ where: { isActive: false } }),
      totalPermissions: await db.Permission.count(),
      weeklyAttendanceRate: await attendanceRate(weeklyStart, todayStr),
      monthlyAttendanceRate: await attendanceRate(monthlyStart, todayStr),
    };
  } else {
    const upcomingLeaveItems = await db.LeaveRequest.findAll({
      where: {
        status: "Approved",
        startDate: { [Op.between]: [todayStr, dayjs().tz(TZ).add(7, "day").format("YYYY-MM-DD")] },
      },
      include: ["employee", "leaveType"],
      order: [["startDate", "ASC"]],
    });

    const newHireItems = await db.Employee.findAll({
      where: { createdAt: { [Op.gte]: monthlyStart } },
      order: [["createdAt", "DESC"]],
    });

    workforce = {
      weeklyAttendanceRate: await attendanceRate(weeklyStart, todayStr),
      monthlyAttendanceRate: await attendanceRate(monthlyStart, todayStr),
      upcomingLeave: { count: upcomingLeaveItems.length, items: upcomingLeaveItems },
      newHires: { count: newHireItems.length, items: newHireItems },
    };
  }

  return sendSuccess(res, 200, {
    orgAttendanceSnapshot,
    pendingLeaveApprovals: { total: pendingTotal, items: pendingItems },
    employeeCountByDepartment,
    recentActivityFeed,
    ...(canManagePermissions ? { system } : { workforce }),
  });
};

const getDashboard = catchAsync(async (req, res) => {
  const { roleName } = req.user;

  if (roleName === "Manager") {
    return managerDashboard(req, res);
  }

  if (roleName === "HR" || roleName === "Admin") {
    return adminDashboard(req, res);
  }

  // 'Employee' and any custom role fall through to the least-privileged layout.
  return employeeDashboard(req, res);
});

module.exports = { getDashboard };
