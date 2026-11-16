const express = require("express");
const router = express.Router();

const leaveRequestController = require("../controllers/leaveRequestController");
const { verifyToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");
const validate = require("../middleware/validate");
const { createLeaveRequestSchema, previewLeaveDaysSchema } = require("../validations/leaveRequestValidation");

router.post(
  "/",
  verifyToken,
  checkPermission("leave", "submit"),
  validate(createLeaveRequestSchema),
  leaveRequestController.createLeaveRequest,
);
router.get(
  "/preview",
  verifyToken,
  checkPermission("leave", "submit"),
  validate(previewLeaveDaysSchema),
  leaveRequestController.previewLeaveDays,
);
router.get("/me", verifyToken, checkPermission("leave", "view_own"), leaveRequestController.getMyLeaveRequests);
router.get("/team", verifyToken, checkPermission("leave", "view_team"), leaveRequestController.getTeamLeaveRequests);
router.get("/", verifyToken, checkPermission("leave", "view_all"), leaveRequestController.listAllLeaveRequests);

// No checkPermission on these three — mixed-scope, authorized inside the controllers.
router.patch("/:id/approve", verifyToken, leaveRequestController.approveLeaveRequest);
router.patch("/:id/reject", verifyToken, leaveRequestController.rejectLeaveRequest);
router.patch("/:id/cancel", verifyToken, leaveRequestController.cancelLeaveRequest);

module.exports = router;
