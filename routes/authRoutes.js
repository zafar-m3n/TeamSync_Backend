const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const validate = require("../middleware/validate");
const { loginSchema } = require("../validations/authValidation");

router.post("/login", validate(loginSchema), authController.login);

module.exports = router;
