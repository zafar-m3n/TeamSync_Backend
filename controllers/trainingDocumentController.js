const db = require("../models");
const { Op } = db.Sequelize;
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const hasPermission = require("../utils/hasPermission");

// "assigned to this employee" = a direct assignment to them, or one to their
// department (only when they actually have a department).
const assignmentScopeOr = (employee) => {
  const conds = [{ employeeId: employee.id }];
  if (employee.departmentId != null) {
    conds.push({ departmentId: employee.departmentId });
  }
  return { [Op.or]: conds };
};

const uploadDocument = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new AppError("A file is required", 400, "FILE_REQUIRED");
  }

  const { title, description, categoryId } = req.body;

  const category = await db.TrainingCategory.findByPk(categoryId);
  if (!category) {
    throw new AppError("Training category not found", 404, "CATEGORY_NOT_FOUND");
  }

  const document = await db.TrainingDocument.create({
    title,
    description,
    filePath: req.file.path,
    categoryId,
    uploadedBy: req.user.id,
  });

  return sendSuccess(res, 201, document);
});

const getMyUploads = catchAsync(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);

  const { rows, count } = await db.TrainingDocument.findAndCountAll({
    where: { uploadedBy: req.user.id },
    include: "category",
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });

  return sendSuccess(res, 200, rows, buildPaginationMeta(page, limit, count));
});

const listAllDocuments = catchAsync(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);

  const where = {};
  if (req.query.categoryId !== undefined) {
    where.categoryId = req.query.categoryId;
  }

  const { rows, count } = await db.TrainingDocument.findAndCountAll({
    where,
    include: "category",
    order: [["createdAt", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  return sendSuccess(res, 200, rows, buildPaginationMeta(page, limit, count));
});

const getAssignedToMe = catchAsync(async (req, res) => {
  const requester = await db.Employee.findOne({ where: { userId: req.user.id } });
  if (!requester) {
    throw new AppError("No employee profile linked to this account", 404, "NO_EMPLOYEE_PROFILE");
  }

  const assignments = await db.TrainingAssignment.findAll({
    where: assignmentScopeOr(requester),
    include: { association: "document", include: "category" },
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

  return sendSuccess(res, 200, documents);
});

const getDocumentById = catchAsync(async (req, res) => {
  const document = await db.TrainingDocument.findByPk(req.params.id, { include: "category" });
  if (!document) {
    throw new AppError("Training document not found", 404, "NOT_FOUND");
  }

  const canViewAll = await hasPermission(req.user.roleId, "training", "view_all");
  if (canViewAll) {
    return sendSuccess(res, 200, document);
  }

  const canViewOwnUploads = await hasPermission(req.user.roleId, "training", "view_own_uploads");
  if (canViewOwnUploads && document.uploadedBy === req.user.id) {
    return sendSuccess(res, 200, document);
  }

  const canViewAssigned = await hasPermission(req.user.roleId, "training", "view_assigned");
  if (canViewAssigned) {
    const requester = await db.Employee.findOne({ where: { userId: req.user.id } });
    if (requester) {
      const assignment = await db.TrainingAssignment.findOne({
        where: { documentId: document.id, ...assignmentScopeOr(requester) },
      });
      if (assignment) {
        return sendSuccess(res, 200, document);
      }
    }
  }

  throw new AppError("You do not have permission to view this training document", 403, "FORBIDDEN");
});

module.exports = { uploadDocument, getMyUploads, listAllDocuments, getAssignedToMe, getDocumentById };
