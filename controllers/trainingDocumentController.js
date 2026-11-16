const db = require("../models");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const hasPermission = require("../utils/hasPermission");
const { getRequesterEmployee } = require("../services/requesterService");
const { assignmentScopeOr } = require("../utils/queryHelpers");
const { sendUpload } = require("../utils/uploads");

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
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
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
  const requester = await getRequesterEmployee(req);

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

// view_all, your own upload (view_own_uploads), or assigned to you (view_assigned).
const assertCanViewDocument = async (req, document) => {
  if (await hasPermission(req.user.roleId, "training", "view_all")) {
    return;
  }

  const canViewOwnUploads = await hasPermission(req.user.roleId, "training", "view_own_uploads");
  if (canViewOwnUploads && document.uploadedBy === req.user.id) {
    return;
  }

  if (await hasPermission(req.user.roleId, "training", "view_assigned")) {
    const requester = await getRequesterEmployee(req, { required: false });
    if (requester) {
      const assignment = await db.TrainingAssignment.findOne({
        where: { documentId: document.id, ...assignmentScopeOr(requester) },
      });
      if (assignment) {
        return;
      }
    }
  }

  throw new AppError("You do not have permission to view this training document", 403, "FORBIDDEN");
};

const getDocumentById = catchAsync(async (req, res) => {
  const document = await db.TrainingDocument.findByPk(req.params.id, { include: "category" });
  if (!document) {
    throw new AppError("Training document not found", 404, "NOT_FOUND");
  }

  await assertCanViewDocument(req, document);
  return sendSuccess(res, 200, document);
});

const downloadDocument = catchAsync(async (req, res) => {
  const document = await db.TrainingDocument.scope("withFilePath").findByPk(req.params.id);
  if (!document) {
    throw new AppError("Training document not found", 404, "NOT_FOUND");
  }

  await assertCanViewDocument(req, document);
  await sendUpload(res, document);
});

module.exports = {
  uploadDocument,
  getMyUploads,
  listAllDocuments,
  getAssignedToMe,
  getDocumentById,
  downloadDocument,
};
