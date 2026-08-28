const express = require("express");
const router = express.Router();

const employeeController = require("../controllers/employeeController");
const { verifyToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");
const validate = require("../middleware/validate");
const { createUploader } = require("../config/multer");
const {
  createEmployeeSchema,
  updateEmployeeSchema,
  uploadDocumentSchema,
  assignShiftSchema,
} = require("../validations/employeeValidation");

const uploadEmployeeDocument = createUploader("employee-documents");

router.post(
  "/",
  verifyToken,
  checkPermission("employees", "create"),
  validate(createEmployeeSchema),
  employeeController.createEmployee,
);

router.get("/", verifyToken, checkPermission("employees", "view_all"), employeeController.listEmployees);

router.get("/me", verifyToken, checkPermission("employees", "view_own"), employeeController.getMyProfile);

router.get("/team", verifyToken, checkPermission("employees", "view_team"), employeeController.getTeam);

// No checkPermission here — mixed-scope authorization happens inside the controller. See Design Decision #2.
router.get("/:id", verifyToken, employeeController.getEmployeeById);

router.patch(
  "/:id",
  verifyToken,
  checkPermission("employees", "edit"),
  validate(updateEmployeeSchema),
  employeeController.updateEmployee,
);

router.patch(
  "/:id/shift",
  verifyToken,
  checkPermission("shifts", "assign"),
  validate(assignShiftSchema),
  employeeController.assignShift,
);

router.post(
  "/:id/documents",
  verifyToken,
  checkPermission("employees", "edit"),
  uploadEmployeeDocument.single("file"),
  validate(uploadDocumentSchema),
  employeeController.uploadDocument,
);

router.delete(
  "/:id/documents/:documentId",
  verifyToken,
  checkPermission("employees", "edit"),
  employeeController.deleteDocument,
);

module.exports = router;
