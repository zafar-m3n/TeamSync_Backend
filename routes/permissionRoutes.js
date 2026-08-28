const express = require("express");
const router = express.Router();

const permissionController = require("../controllers/permissionController");
const { verifyToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");
const validate = require("../middleware/validate");
const { updatePermissionSchema, bulkUpdatePermissionsSchema } = require("../validations/permissionValidation");

router.get("/", verifyToken, checkPermission("permissions", "view"), permissionController.listPermissions);

// /bulk must be registered before /:id, or Express will try to match "bulk" as an :id param.
router.patch(
  "/bulk",
  verifyToken,
  checkPermission("permissions", "manage"),
  validate(bulkUpdatePermissionsSchema),
  permissionController.bulkUpdatePermissions,
);
router.patch(
  "/:id",
  verifyToken,
  checkPermission("permissions", "manage"),
  validate(updatePermissionSchema),
  permissionController.updatePermission,
);

module.exports = router;
