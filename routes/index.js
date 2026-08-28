const express = require("express");
const router = express.Router();

router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    data: { status: "ok", timestamp: new Date().toISOString() },
  });
});

// Later phases mount their module routers here, e.g.:
// router.use('/departments', require('./department.routes'));
// router.use('/roles', require('./role.routes'));
// router.use('/permissions', require('./permission.routes'));
// router.use('/employees', require('./employee.routes'));
// ...

module.exports = router;
