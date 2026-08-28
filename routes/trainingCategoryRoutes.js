const express = require("express");
const router = express.Router();

const controller = require("../controllers/trainingCategoryController");
const { verifyToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");
const validate = require("../middleware/validate");
const {
  createTrainingCategorySchema,
  updateTrainingCategorySchema,
} = require("../validations/trainingCategoryValidation");

router.post(
  "/",
  verifyToken,
  checkPermission("training_categories", "manage"),
  validate(createTrainingCategorySchema),
  controller.createCategory,
);
router.get("/", verifyToken, checkPermission("training_categories", "view"), controller.listCategories);
router.patch(
  "/:id",
  verifyToken,
  checkPermission("training_categories", "manage"),
  validate(updateTrainingCategorySchema),
  controller.updateCategory,
);
router.delete("/:id", verifyToken, checkPermission("training_categories", "manage"), controller.deleteCategory);

module.exports = router;
