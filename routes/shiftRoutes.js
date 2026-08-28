const express = require("express");
const router = express.Router();

const shiftController = require("../controllers/shiftController");
const { verifyToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");
const validate = require("../middleware/validate");
const { createShiftSchema, updateShiftSchema } = require("../validations/shiftValidation");

router.post(
  "/",
  verifyToken,
  checkPermission("shifts", "manage"),
  validate(createShiftSchema),
  shiftController.createShift,
);
router.get("/", verifyToken, checkPermission("shifts", "manage"), shiftController.listShifts);
router.get("/:id", verifyToken, checkPermission("shifts", "manage"), shiftController.getShift);
router.patch(
  "/:id",
  verifyToken,
  checkPermission("shifts", "manage"),
  validate(updateShiftSchema),
  shiftController.updateShift,
);

module.exports = router;
