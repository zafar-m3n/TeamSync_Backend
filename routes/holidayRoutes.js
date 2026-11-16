const express = require("express");
const router = express.Router();

const holidayController = require("../controllers/holidayController");
const { verifyToken } = require("../middleware/auth");
const { checkPermission } = require("../middleware/permission");
const validate = require("../middleware/validate");
const {
  listHolidaysSchema,
  createHolidaySchema,
  updateHolidaySchema,
  deleteHolidaySchema,
} = require("../validations/holidayValidation");

const manage = [verifyToken, checkPermission("holidays", "manage")];

router.get(
  "/",
  verifyToken,
  checkPermission("holidays", "view"),
  validate(listHolidaysSchema),
  holidayController.listHolidays,
);
router.post("/", ...manage, validate(createHolidaySchema), holidayController.createHoliday);
router.patch("/:id", ...manage, validate(updateHolidaySchema), holidayController.updateHoliday);
router.delete("/:id", ...manage, validate(deleteHolidaySchema), holidayController.deleteHoliday);

module.exports = router;
