const cron = require("node-cron");
const logger = require("../utils/logger");
const { dayjs, TZ, nowTz } = require("../utils/time");
const { applyDueTerminations, LEAVING_STATUSES } = require("../services/employmentStatusService");
const { shiftWindow } = require("../services/attendanceService");
const { isWorkingDay } = require("../services/workingDayService");

const WORKING_STATUSES = ["Active", "Probation"];
// Leavers still serving notice work until their termination date (the first day
// without access, as in blocksAccess), so their absences count until then.
const onNotice = (employee, day) =>
  LEAVING_STATUSES.includes(employee.employmentStatus) && employee.terminationDate > day;
// Overnight shifts end the next calendar day, so each run settles the last two shift
// days; an employee is only handled once their shift on that day has ended.
const DAYS_BACK = [2, 1];

const settleShiftDays = async (now) => {
  const db = require("../models");
  const { Op } = db.Sequelize;
  const days = DAYS_BACK.map((n) => now.subtract(n, "day").format("YYYY-MM-DD"));
  const [first, last] = [days[0], days[days.length - 1]];

  const [employees, records, leaves, holidays] = await Promise.all([
    db.Employee.findAll({
      where: {
        shiftId: { [Op.ne]: null },
        [Op.and]: [
          { [Op.or]: [{ dateOfJoining: null }, { dateOfJoining: { [Op.lte]: last } }] },
          {
            [Op.or]: [
              { employmentStatus: { [Op.in]: WORKING_STATUSES } },
              {
                employmentStatus: { [Op.in]: LEAVING_STATUSES },
                terminationDate: { [Op.gt]: first },
              },
            ],
          },
        ],
      },
      attributes: ["id", "dateOfJoining", "employmentStatus", "terminationDate"],
      include: { association: "shift", attributes: ["startTime", "endTime", "workingDays"] },
    }),
    db.AttendanceRecord.findAll({
      where: { date: { [Op.between]: [first, last] } },
      attributes: ["id", "employeeId", "date", "clockIn", "clockOut"],
    }),
    db.LeaveRequest.findAll({
      where: {
        status: "Approved",
        isHalfDay: false,
        startDate: { [Op.lte]: last },
        endDate: { [Op.gte]: first },
      },
      attributes: ["employeeId", "startDate", "endDate"],
    }),
    db.Holiday.findAll({ where: { date: { [Op.between]: [first, last] } }, attributes: ["date"] }),
  ]);

  const holidaySet = new Set(holidays.map((h) => h.date));
  const recordOf = new Map(records.map((r) => [`${r.employeeId}|${r.date}`, r]));
  const onLeave = (employeeId, day) =>
    leaves.some((l) => l.employeeId === employeeId && l.startDate <= day && l.endDate >= day);

  const absent = [];
  const clockOuts = new Map(); // shift end (ISO) → record ids

  for (const day of days) {
    for (const employee of employees) {
      if (employee.dateOfJoining && employee.dateOfJoining > day) continue;
      if (!WORKING_STATUSES.includes(employee.employmentStatus) && !onNotice(employee, day)) continue;
      const { end } = shiftWindow(employee.shift, day);
      if (end.isAfter(now)) continue; // still running; next run settles it

      const record = recordOf.get(`${employee.id}|${day}`);
      if (record) {
        if (record.clockIn && !record.clockOut) {
          const key = end.toISOString();
          clockOuts.set(key, [...(clockOuts.get(key) || []), record.id]);
        }
        continue;
      }
      if (!isWorkingDay(day, employee.shift.workingDays, holidaySet)) continue;
      if (onLeave(employee.id, day)) continue;
      absent.push({ employeeId: employee.id, date: day, status: "Absent" });
    }
  }

  if (absent.length) {
    await db.AttendanceRecord.bulkCreate(absent, { ignoreDuplicates: true });
  }
  for (const [endIso, ids] of clockOuts) {
    await db.AttendanceRecord.update({ clockOut: new Date(endIso) }, { where: { id: ids } });
  }

  return { days, absent: absent.length, clockedOut: [...clockOuts.values()].flat().length };
};

// Nightly: apply due terminations first, then mark Absent and auto clock-out for
// shifts that have ended (leavers only up to their termination date).
const runDailyAttendanceJob = async ({ now = nowTz() } = {}) => {
  try {
    const deactivated = await applyDueTerminations();
    const result = await settleShiftDays(dayjs(now).tz(TZ));
    logger.cron(
      `Nightly attendance job (${result.days.join(", ")}): ${result.absent} absent, ` +
        `${result.clockedOut} auto clock-out(s), ${deactivated} account(s) deactivated`,
    );
    return { ...result, deactivated };
  } catch (err) {
    logger.error(`Nightly attendance job failed: ${err.message}`);
    return null;
  }
};

const scheduleAttendanceCron = () => {
  const schedule = process.env.NODE_TEAMSYNC_ATTENDANCE_CRON_SCHEDULE || "5 0 * * *";
  cron.schedule(schedule, () => runDailyAttendanceJob(), { timezone: TZ });
  logger.info(`Nightly attendance cron scheduled: ${schedule} (${TZ})`);
  // Catch up on terminations that came due while the server was down.
  applyDueTerminations().catch((err) =>
    logger.error(`Termination catch-up failed: ${err.message}`),
  );
};

module.exports = { scheduleAttendanceCron };
