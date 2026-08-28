const express = require("express");
const router = express.Router();

const departmentController = require("../controllers/departmentController");
const { verifyToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");
const validate = require("../middleware/validate");
const { createDepartmentSchema, updateDepartmentSchema } = require("../validations/departmentValidation");

router.post(
  "/",
  verifyToken,
  checkPermission("departments", "create"),
  validate(createDepartmentSchema),
  departmentController.createDepartment,
);
router.get("/", verifyToken, checkPermission("departments", "view"), departmentController.listDepartments);
router.get("/:id", verifyToken, checkPermission("departments", "view"), departmentController.getDepartment);
router.patch(
  "/:id",
  verifyToken,
  checkPermission("departments", "edit"),
  validate(updateDepartmentSchema),
  departmentController.updateDepartment,
);
router.delete("/:id", verifyToken, checkPermission("departments", "delete"), departmentController.deleteDepartment);

module.exports = router;
