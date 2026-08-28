const express = require("express");
const router = express.Router();

router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    data: { status: "ok", timestamp: new Date().toISOString() },
  });
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

module.exports = router;
