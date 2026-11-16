const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const validate = require("../middleware/validate");
const { verifyToken } = require("../middleware/auth");
const { loginRateLimit } = require("../middleware/loginRateLimit");
const { loginSchema } = require("../validations/authValidation");

router.post("/login", loginRateLimit, validate(loginSchema), authController.login);
router.get("/me", verifyToken, authController.me);

module.exports = router;
