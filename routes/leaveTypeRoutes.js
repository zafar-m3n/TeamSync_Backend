const express = require("express");
const router = express.Router();

const leaveTypeController = require("../controllers/leaveTypeController");
const { verifyToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");
const validate = require("../middleware/validate");
const { createLeaveTypeSchema, updateLeaveTypeSchema } = require("../validations/leaveTypeValidation");

router.post(
  "/",
  verifyToken,
  checkPermission("leave_types", "manage"),
  validate(createLeaveTypeSchema),
  leaveTypeController.createLeaveType,
);
router.get("/", verifyToken, checkPermission("leave_types", "view"), leaveTypeController.listLeaveTypes);
router.patch(
  "/:id",
  verifyToken,
  checkPermission("leave_types", "manage"),
  validate(updateLeaveTypeSchema),
  leaveTypeController.updateLeaveType,
);
router.delete("/:id", verifyToken, checkPermission("leave_types", "manage"), leaveTypeController.deleteLeaveType);

module.exports = router;
