const express = require("express");
const router = express.Router();

const roleController = require("../controllers/roleController");
const { verifyToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");
const validate = require("../middleware/validate");
const { createRoleSchema } = require("../validations/roleValidation");

router.get("/", verifyToken, checkPermission("roles", "view"), roleController.listRoles);
router.post("/", verifyToken, checkPermission("roles", "manage"), validate(createRoleSchema), roleController.createRole);

module.exports = router;
