const express = require("express");
const router = express.Router();

const attendanceController = require("../controllers/attendanceController");
const { verifyToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");
const validate = require("../middleware/validate");
const { updateAttendanceSchema, overrideAttendanceSchema } = require("../validations/attendanceValidation");

router.get("/me", verifyToken, checkPermission("attendance", "view_own"), attendanceController.getMyAttendance);
router.get("/team", verifyToken, checkPermission("attendance", "view_team"), attendanceController.getTeamAttendance);
router.get("/", verifyToken, checkPermission("attendance", "view_all"), attendanceController.listAllAttendance);
router.patch(
  "/:id/override",
  verifyToken,
  checkPermission("attendance", "override"),
  validate(overrideAttendanceSchema),
  attendanceController.overrideAttendance,
);
router.patch(
  "/:id",
  verifyToken,
  checkPermission("attendance", "edit"),
  validate(updateAttendanceSchema),
  attendanceController.updateAttendance,
);

module.exports = router;
