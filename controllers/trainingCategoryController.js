const db = require("../models");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");

const createCategory = catchAsync(async (req, res) => {
  const { name } = req.body;

  const existing = await db.TrainingCategory.findOne({ where: { name } });
  if (existing) {
    throw new AppError("A training category with this name already exists", 409, "CATEGORY_NAME_TAKEN");
  }

  const category = await db.TrainingCategory.create({ name });
  return sendSuccess(res, 201, category);
});

const listCategories = catchAsync(async (req, res) => {
  const categories = await db.TrainingCategory.findAll({ order: [["name", "ASC"]] });
  return sendSuccess(res, 200, categories);
});

const updateCategory = catchAsync(async (req, res) => {
  const category = await db.TrainingCategory.findByPk(req.params.id);
  if (!category) {
    throw new AppError("Training category not found", 404, "NOT_FOUND");
  }

  const { name } = req.body;
  if (name && name !== category.name) {
    const taken = await db.TrainingCategory.findOne({ where: { name } });
    if (taken) {
      throw new AppError("A training category with this name already exists", 409, "CATEGORY_NAME_TAKEN");
    }
  }

  await category.update(req.body);
  return sendSuccess(res, 200, category);
});

const deleteCategory = catchAsync(async (req, res) => {
  const category = await db.TrainingCategory.findByPk(req.params.id);
  if (!category) {
    throw new AppError("Training category not found", 404, "NOT_FOUND");
  }

  // paranoid: false — a soft-deleted document still holds the FK, so the DB's
  // ON DELETE RESTRICT would still fire; count those too for a clean 409.
  const referencing = await db.TrainingDocument.count({
    where: { categoryId: category.id },
    paranoid: false,
  });
  if (referencing > 0) {
    throw new AppError("Cannot delete a category that has documents referencing it", 409, "CATEGORY_IN_USE");
  }

  await category.destroy();
  return sendSuccess(res, 200, { message: "Training category deleted" });
});

module.exports = { createCategory, listCategories, updateCategory, deleteCategory };
