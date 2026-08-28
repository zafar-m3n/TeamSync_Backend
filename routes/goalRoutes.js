const express = require("express");
const router = express.Router();

const goalController = require("../controllers/goalController");
const { verifyToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");
const validate = require("../middleware/validate");
const { createGoalSchema, updateGoalSchema, recordActualSchema } = require("../validations/goalValidation");

router.post("/", verifyToken, checkPermission("goals", "create"), validate(createGoalSchema), goalController.createGoal);
router.get("/me", verifyToken, checkPermission("goals", "view_own"), goalController.getMyGoals);
router.get("/team", verifyToken, checkPermission("goals", "view_team"), goalController.getTeamGoals);
router.get("/", verifyToken, checkPermission("goals", "view_all"), goalController.listAllGoals);

// No checkPermission — mixed-scope, authorized inside the controller.
router.get("/:id", verifyToken, goalController.getGoalById);

router.patch("/:id", verifyToken, checkPermission("goals", "edit"), validate(updateGoalSchema), goalController.updateGoal);
router.patch(
  "/:id/actual",
  verifyToken,
  checkPermission("goals", "record_actual"),
  validate(recordActualSchema),
  goalController.recordActual,
);

module.exports = router;
