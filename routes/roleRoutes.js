const express = require("express");
const router = express.Router();

const roleController = require("../controllers/roleController");
const { verifyToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");
const validate = require("../middleware/validate");
const { createRoleSchema, updateRoleSchema } = require("../validations/roleValidation");

router.get("/", verifyToken, checkPermission("roles", "view"), roleController.listRoles);
router.post("/", verifyToken, checkPermission("roles", "manage"), validate(createRoleSchema), roleController.createRole);
router.patch("/:id", verifyToken, checkPermission("roles", "manage"), validate(updateRoleSchema), roleController.updateRole);

module.exports = router;
