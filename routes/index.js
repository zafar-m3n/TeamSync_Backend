const express = require("express");
const router = express.Router();

const { sendSuccess } = require("../utils/apiResponse");

router.get("/health", (req, res) => {
  sendSuccess(res, 200, { status: "ok", timestamp: new Date().toISOString() });
});

router.use("/auth", require("./authRoutes"));
router.use("/users", require("./userRoutes"));
router.use("/roles", require("./roleRoutes"));
router.use("/departments", require("./departmentRoutes"));
router.use("/permissions", require("./permissionRoutes"));
router.use("/employees", require("./employeeRoutes"));
router.use("/shifts", require("./shiftRoutes"));
router.use("/attendance", require("./attendanceRoutes"));
router.use("/leave-types", require("./leaveTypeRoutes"));
router.use("/leave-balances", require("./leaveBalanceRoutes"));
router.use("/leave-requests", require("./leaveRequestRoutes"));
router.use("/goals", require("./goalRoutes"));
router.use("/training-categories", require("./trainingCategoryRoutes"));
router.use("/training-documents", require("./trainingDocumentRoutes"));
router.use("/training-assignments", require("./trainingAssignmentRoutes"));
router.use("/dashboard", require("./dashboardRoutes"));

module.exports = router;
