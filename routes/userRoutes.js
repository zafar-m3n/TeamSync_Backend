const express = require("express");
const router = express.Router();

const userController = require("../controllers/userController");
const { verifyToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");
const validate = require("../middleware/validate");
const { resetPasswordSchema, updateStatusSchema } = require("../validations/userValidation");

router.patch(
  "/:id/password",
  verifyToken,
  checkPermission("users", "reset_password"),
  validate(resetPasswordSchema),
  userController.resetPassword,
);

router.get("/", verifyToken, checkPermission("users", "view"), userController.listUsers);
router.get("/:id", verifyToken, checkPermission("users", "view"), userController.getUser);
router.patch(
  "/:id/status",
  verifyToken,
  checkPermission("users", "update_status"),
  validate(updateStatusSchema),
  userController.updateStatus,
);

module.exports = router;
