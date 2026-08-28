const dayjs = require("dayjs");

const db = require("../models");
const { Op } = db.Sequelize;
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const hasPermission = require("../utils/hasPermission");

const assertIsDirectReport = async (req, targetEmployeeId) => {
  const db = require("../models");
  const AppError = require("../utils/AppError");

  const requesterEmployee = await db.Employee.findOne({ where: { userId: req.user.id } });
  if (!requesterEmployee) {
    throw new AppError("No employee profile linked to this account", 404, "NO_EMPLOYEE_PROFILE");
  }

  const target = await db.Employee.findByPk(targetEmployeeId);
  if (!target) {
    throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
  }

  if (target.managerId !== requesterEmployee.id) {
    throw new AppError("This employee is not your direct report", 403, "NOT_YOUR_DIRECT_REPORT");
  }

  return { requesterEmployee, target };
};

const createGoal = catchAsync(async (req, res) => {
  const { employeeId, title, description, numericTarget, targetDate } = req.body;

  await assertIsDirectReport(req, employeeId);

  const goal = await db.Goal.create({
    employeeId,
    managerId: req.user.id,
    title,
    description,
    numericTarget,
    targetDate,
  });

  return sendSuccess(res, 201, goal);
});

const getMyGoals = catchAsync(async (req, res) => {
  const requester = await db.Employee.findOne({ where: { userId: req.user.id } });
  if (!requester) {
    throw new AppError("No employee profile linked to this account", 404, "NO_EMPLOYEE_PROFILE");
  }

  const { page, limit, offset } = parsePagination(req.query);

  const { rows, count } = await db.Goal.findAndCountAll({
    where: { employeeId: requester.id },
    order: [["targetDate", "DESC"]],
    limit,
    offset,
  });

  return sendSuccess(res, 200, rows, buildPaginationMeta(page, limit, count));
});

const getTeamGoals = catchAsync(async (req, res) => {
  const requester = await db.Employee.findOne({ where: { userId: req.user.id } });
  if (!requester) {
    throw new AppError("No employee profile linked to this account", 404, "NO_EMPLOYEE_PROFILE");
  }

  const reports = await db.Employee.findAll({
    where: { managerId: requester.id },
    attributes: ["id"],
  });
  const reportIds = reports.map((r) => r.id);

  const { page, limit, offset } = parsePagination(req.query);

  const { rows, count } = await db.Goal.findAndCountAll({
    where: { employeeId: { [Op.in]: reportIds } },
    include: "employee",
    order: [["targetDate", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  return sendSuccess(res, 200, rows, buildPaginationMeta(page, limit, count));
});

const listAllGoals = catchAsync(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);

  const where = {};
  if (req.query.employeeId !== undefined) {
    where.employeeId = req.query.employeeId;
  }

  const { month, year } = req.query;
  if (month && year) {
    const start = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
    where.targetDate = {
      [Op.between]: [start.format("YYYY-MM-DD"), start.endOf("month").format("YYYY-MM-DD")],
    };
  } else if (year) {
    where.targetDate = { [Op.between]: [`${year}-01-01`, `${year}-12-31`] };
  }

  const { rows, count } = await db.Goal.findAndCountAll({
    where,
    include: "employee",
    order: [["targetDate", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  return sendSuccess(res, 200, rows, buildPaginationMeta(page, limit, count));
});

const getGoalById = catchAsync(async (req, res) => {
  const goal = await db.Goal.findByPk(req.params.id, { include: "employee" });
  if (!goal) {
    throw new AppError("Goal not found", 404, "NOT_FOUND");
  }

  const canViewAll = await hasPermission(req.user.roleId, "goals", "view_all");
  if (canViewAll) {
    return sendSuccess(res, 200, goal);
  }

  const requester = await db.Employee.findOne({ where: { userId: req.user.id } });

  const canViewTeam = await hasPermission(req.user.roleId, "goals", "view_team");
  if (canViewTeam && requester && goal.employee && goal.employee.managerId === requester.id) {
    return sendSuccess(res, 200, goal);
  }

  const canViewOwn = await hasPermission(req.user.roleId, "goals", "view_own");
  if (canViewOwn && requester && goal.employee && goal.employee.id === requester.id) {
    return sendSuccess(res, 200, goal);
  }

  throw new AppError("You do not have permission to view this goal", 403, "FORBIDDEN");
});

const updateGoal = catchAsync(async (req, res) => {
  const goal = await db.Goal.findByPk(req.params.id, { include: "employee" });
  if (!goal) {
    throw new AppError("Goal not found", 404, "NOT_FOUND");
  }

  await assertIsDirectReport(req, goal.employeeId);

  await goal.update(req.body);

  return sendSuccess(res, 200, goal);
});

const recordActual = catchAsync(async (req, res) => {
  const goal = await db.Goal.findByPk(req.params.id, { include: "employee" });
  if (!goal) {
    throw new AppError("Goal not found", 404, "NOT_FOUND");
  }

  await assertIsDirectReport(req, goal.employeeId);

  const { actualValue } = req.body;
  const percentComplete = Math.round((actualValue / goal.numericTarget) * 10000) / 100;

  await goal.update({ actualValue, percentComplete });

  return sendSuccess(res, 200, goal);
});

module.exports = {
  createGoal,
  getMyGoals,
  getTeamGoals,
  listAllGoals,
  getGoalById,
  updateGoal,
  recordActual,
};
