const db = require("../models");
const { Op } = db.Sequelize;
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess, sendDeleted } = require("../utils/apiResponse");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const hasPermission = require("../utils/hasPermission");
const { getRequesterEmployee } = require("../services/requesterService");

// Mirrors the unique indexes on (document_id, employee_id) and (document_id, department_id).
const assertNotAssigned = async ({ documentId, employeeId, departmentId }) => {
  const targets = [];
  if (employeeId != null) targets.push({ employeeId });
  if (departmentId != null) targets.push({ departmentId });

  const existing = await db.TrainingAssignment.findOne({ where: { documentId, [Op.or]: targets } });
  if (existing) {
    const target = employeeId != null && existing.employeeId === employeeId ? "employee" : "department";
    throw new AppError(`This document is already assigned to that ${target}`, 409, "ASSIGNMENT_EXISTS");
  }
};

const createAssignment = catchAsync(async (req, res) => {
  const { documentId, employeeId, departmentId } = req.body;

  const document = await db.TrainingDocument.findByPk(documentId);
  if (!document) {
    throw new AppError("Training document not found", 404, "DOCUMENT_NOT_FOUND");
  }

  const requester = await getRequesterEmployee(req);

  if (employeeId != null) {
    const target = await db.Employee.findByPk(employeeId);
    if (!target) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }
    if (target.managerId !== requester.id) {
      throw new AppError("This employee is not your direct report", 403, "NOT_YOUR_DIRECT_REPORT");
    }
  }

  if (departmentId != null) {
    const department = await db.Department.findByPk(departmentId);
    if (!department) {
      throw new AppError("Department not found", 404, "DEPARTMENT_NOT_FOUND");
    }
    if (department.departmentHeadId !== requester.id) {
      throw new AppError("You are not the head of this department", 403, "NOT_YOUR_DEPARTMENT");
    }
  }

  await assertNotAssigned({ documentId, employeeId, departmentId });

  let assignment;
  try {
    assignment = await db.TrainingAssignment.create({
      documentId,
      employeeId,
      departmentId,
      assignedBy: req.user.id,
    });
  } catch (error) {
    // A concurrent request won the race to the unique index.
    if (error.name === "SequelizeUniqueConstraintError") {
      throw new AppError("This document is already assigned to that target", 409, "ASSIGNMENT_EXISTS");
    }
    throw error;
  }

  return sendSuccess(res, 201, assignment);
});

const getMyAssignments = catchAsync(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);

  const { rows, count } = await db.TrainingAssignment.findAndCountAll({
    where: { assignedBy: req.user.id },
    include: ["document", "employee", "department"],
    order: [["createdAt", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  return sendSuccess(res, 200, rows, buildPaginationMeta(page, limit, count));
});

const listAllAssignments = catchAsync(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);

  const where = {};
  if (req.query.documentId !== undefined) {
    where.documentId = req.query.documentId;
  }
  if (req.query.employeeId !== undefined) {
    where.employeeId = req.query.employeeId;
  }
  if (req.query.departmentId !== undefined) {
    where.departmentId = req.query.departmentId;
  }

  const { rows, count } = await db.TrainingAssignment.findAndCountAll({
    where,
    include: ["document", "employee", "department"],
    order: [["createdAt", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  return sendSuccess(res, 200, rows, buildPaginationMeta(page, limit, count));
});

const removeAssignment = catchAsync(async (req, res) => {
  const assignment = await db.TrainingAssignment.findByPk(req.params.id);
  if (!assignment) {
    throw new AppError("Assignment not found", 404, "NOT_FOUND");
  }

  const canViewAll = await hasPermission(req.user.roleId, "training", "view_all");

  if (!canViewAll) {
    const canRemove = await hasPermission(req.user.roleId, "training", "remove_assignment");
    if (!(canRemove && assignment.assignedBy === req.user.id)) {
      throw new AppError("You do not have permission to remove this assignment", 403, "FORBIDDEN");
    }
  }

  await assignment.destroy();
  return sendDeleted(res, assignment.id, "Assignment removed");
});

module.exports = { createAssignment, getMyAssignments, listAllAssignments, removeAssignment };
