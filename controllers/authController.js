const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const db = require("../models");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");

dayjs.extend(utc);
dayjs.extend(timezone);

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const user = await db.User.findOne({
    where: { email },
    include: [{ model: db.Role, as: "role" }],
  });

  if (!user) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  if (!user.isActive) {
    throw new AppError("Account is inactive", 403, "ACCOUNT_INACTIVE");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  // --- Attendance clock-in (after credentials verified, before responding) ---
  try {
    const TZ = process.env.NODE_TEAMSYNC_APP_TIMEZONE || "UTC";

    const employee = await db.Employee.findOne({ where: { userId: user.id }, include: "shift" });

    if (employee && employee.shift) {
      const now = dayjs().tz(TZ);
      const today = now.format("YYYY-MM-DD");

      const existing = await db.AttendanceRecord.findOne({
        where: { employeeId: employee.id, date: today },
      });

      if (!existing) {
        const [startHour, startMinute] = employee.shift.startTime.split(":");
        const shiftStart = now.hour(Number(startHour)).minute(Number(startMinute)).second(0);
        const graceDeadline = shiftStart.add(employee.shift.gracePeriodMinutes, "minute");
        const status = now.isAfter(graceDeadline) ? "Late" : "Present";

        await db.AttendanceRecord.create({
          employeeId: employee.id,
          date: today,
          clockIn: now.toDate(),
          status,
        });
      }
    }
  } catch (err) {
    require("../utils/logger").error(`Attendance clock-in failed for user ${user.id}: ${err.message}`);
  }

  const token = jwt.sign(
    { userId: user.id, roleId: user.roleId, roleName: user.role.name },
    process.env.NODE_TEAMSYNC_JWT_SECRET,
    { expiresIn: process.env.NODE_TEAMSYNC_JWT_EXPIRES_IN },
  );

  return sendSuccess(res, 200, {
    token,
    user: {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
    },
  });
});

module.exports = { login };
