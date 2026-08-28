const cron = require("node-cron");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const logger = require("../utils/logger");

const TZ = process.env.NODE_TEAMSYNC_APP_TIMEZONE || "UTC";

const runDailyAttendanceJob = async () => {
  const db = require("../models");

  try {
    const yesterday = dayjs().tz(TZ).subtract(1, "day");
    const dateStr = yesterday.format("YYYY-MM-DD");
    const weekday = yesterday.format("ddd");

    const employees = await db.Employee.findAll({
      where: { shiftId: { [db.Sequelize.Op.ne]: null } },
      include: "shift",
    });

    for (const employee of employees) {
      if (!employee.shift.workingDays.includes(weekday)) continue;

      const existing = await db.AttendanceRecord.findOne({
        where: { employeeId: employee.id, date: dateStr },
      });

      if (!existing) {
        await db.AttendanceRecord.create({
          employeeId: employee.id,
          date: dateStr,
          status: "Absent",
        });
        continue;
      }

      if (existing.clockIn && !existing.clockOut) {
        const [endHour, endMinute] = employee.shift.endTime.split(":");
        const clockOutTime = yesterday.hour(Number(endHour)).minute(Number(endMinute)).second(0);
        await existing.update({ clockOut: clockOutTime.toDate() });
      }
    }

    logger.cron(`Daily attendance job completed for ${dateStr}`);
  } catch (err) {
    logger.error(`Daily attendance job failed: ${err.message}`);
  }
};

const scheduleAttendanceCron = () => {
  const schedule = process.env.NODE_TEAMSYNC_ATTENDANCE_CRON_SCHEDULE || "0 0 * * *";
  cron.schedule(schedule, runDailyAttendanceJob);
  logger.info(`Attendance cron scheduled: ${schedule}`);
};

module.exports = { scheduleAttendanceCron, runDailyAttendanceJob };
