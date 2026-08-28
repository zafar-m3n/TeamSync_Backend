const express = require("express");
const router = express.Router();

const leaveBalanceController = require("../controllers/leaveBalanceController");
const { verifyToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");
const validate = require("../middleware/validate");
const { setLeaveBalanceSchema } = require("../validations/leaveBalanceValidation");

router.get("/me", verifyToken, checkPermission("leave", "view_own"), leaveBalanceController.getMyLeaveBalance);
router.put(
  "/:employeeId/:year",
  verifyToken,
  checkPermission("leave", "set_quota"),
  validate(setLeaveBalanceSchema),
  leaveBalanceController.setLeaveBalance,
);
// No checkPermission — mixed-scope, authorized inside the controller.
router.get("/:employeeId", verifyToken, leaveBalanceController.getEmployeeLeaveBalance);

module.exports = router;
