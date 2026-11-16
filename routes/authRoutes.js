const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const validate = require("../middleware/validate");
const { verifyToken } = require("../middleware/auth");
const { loginRateLimit, changePasswordRateLimit } = require("../middleware/passwordRateLimit");
const { loginSchema, changePasswordSchema } = require("../validations/authValidation");

router.post("/login", loginRateLimit, validate(loginSchema), authController.login);
router.get("/me", verifyToken, authController.me);
router.post(
  "/change-password",
  verifyToken,
  validate(changePasswordSchema),
  changePasswordRateLimit,
  authController.changePassword,
);

module.exports = router;
