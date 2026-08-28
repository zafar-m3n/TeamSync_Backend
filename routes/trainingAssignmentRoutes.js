const express = require("express");
const router = express.Router();

const controller = require("../controllers/trainingAssignmentController");
const { verifyToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");
const validate = require("../middleware/validate");
const { createAssignmentSchema } = require("../validations/trainingAssignmentValidation");

router.post(
  "/",
  verifyToken,
  checkPermission("training", "assign"),
  validate(createAssignmentSchema),
  controller.createAssignment,
);
router.get("/mine", verifyToken, checkPermission("training", "view_own_uploads"), controller.getMyAssignments);
router.get("/", verifyToken, checkPermission("training", "view_all"), controller.listAllAssignments);

// No checkPermission — mixed-scope, authorized inside the controller.
router.delete("/:id", verifyToken, controller.removeAssignment);

module.exports = router;
