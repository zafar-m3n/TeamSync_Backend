const express = require("express");
const router = express.Router();

const attendanceController = require("../controllers/attendanceController");
const { verifyToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");
const validate = require("../middleware/validate");
const {
  updateAttendanceSchema,
  overrideAttendanceSchema,
  teamAttendanceQuerySchema,
} = require("../validations/attendanceValidation");

const canClock = [verifyToken, checkPermission("attendance", "clock")];
router.get("/me/today", ...canClock, attendanceController.getMyClockStatus);
router.post("/clock-in", ...canClock, attendanceController.clockInMe);
router.post("/clock-out", ...canClock, attendanceController.clockOutMe);
router.get("/me", verifyToken, checkPermission("attendance", "view_own"), attendanceController.getMyAttendance);
router.get(
  "/team",
  verifyToken,
  checkPermission("attendance", "view_team"),
  validate(teamAttendanceQuerySchema),
  attendanceController.getTeamAttendance,
);
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
