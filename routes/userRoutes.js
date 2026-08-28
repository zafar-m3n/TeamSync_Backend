const express = require("express");
const router = express.Router();

const userController = require("../controllers/userController");
const { verifyToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");
const validate = require("../middleware/validate");
const { resetPasswordSchema } = require("../validations/userValidation");

router.patch(
  "/:id/password",
  verifyToken,
  checkPermission("users", "reset_password"),
  validate(resetPasswordSchema),
  userController.resetPassword,
);

module.exports = router;
