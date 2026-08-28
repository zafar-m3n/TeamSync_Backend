const express = require("express");
const router = express.Router();

const roleController = require("../controllers/roleController");
const { verifyToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");

router.get("/", verifyToken, checkPermission("roles", "view"), roleController.listRoles);

module.exports = router;
