const AppError = require("../utils/AppError");
const { dayjs, TZ, nowTz } = require("../utils/time");

const addDays = (day, n) => dayjs(day).add(n, "day").format("YYYY-MM-DD");

// A shift whose end time is not after its start time runs past midnight.
const isOvernight = (shift) => shift.endTime <= shift.startTime;

// Start and end of the shift that begins on `day` (the shift day), in the app timezone.
const shiftWindow = (shift, day) => ({
  start: dayjs.tz(`${day} ${shift.startTime}`, TZ),
  end: dayjs.tz(`${isOvernight(shift) ? addDays(day, 1) : day} ${shift.endTime}`, TZ),
});

// The shift day `now` belongs to: yesterday while an overnight shift that started
// yesterday is still running, otherwise today.
const currentShiftDay = (shift, now = nowTz()) => {
  const today = now.format("YYYY-MM-DD");
  if (isOvernight(shift)) {
    const yesterday = addDays(today, -1);
    if (now.isBefore(shiftWindow(shift, yesterday).end)) {
      return yesterday;
    }
  }
  return today;
};

const isLate = (shift, day, at) =>
  dayjs(at).isAfter(shiftWindow(shift, day).start.add(shift.gracePeriodMinutes, "minute"));

const markHalfDay = async (employeeId, dateStr, { transaction } = {}) => {
  const db = require("../models");

  const [record] = await db.AttendanceRecord.findOrCreate({
    where: { employeeId, date: dateStr },
    defaults: { status: "Half-day", isManualOverride: true },
    transaction,
  });

  if (record.status !== "Half-day") {
    await record.update({ status: "Half-day", isManualOverride: true }, { transaction });
  }

  return record;
};

// The employee's shift, current shift day, that day's record, and the record a
// clock-out would close (that day's, or an overnight one left open from the day before).
const loadClockState = async (employeeId, now, { transaction, lock } = {}) => {
  const db = require("../models");
  const employee = await db.Employee.findByPk(employeeId, { include: "shift", transaction });
  if (!employee || !employee.shift) {
    throw new AppError("You have no shift assigned, so you can't clock in", 400, "NO_SHIFT_ASSIGNED");
  }
  const { shift } = employee;
  const day = currentShiftDay(shift, now);
  const records = await db.AttendanceRecord.findAll({
    where: { employeeId, date: [addDays(day, -1), day] },
    transaction,
    lock: lock && transaction.LOCK.UPDATE,
  });
  const record = records.find((r) => r.date === day) ?? null;
  const previous = records.find((r) => r.date !== day);
  // Only an overnight shift can still be open from the previous day; the nightly
  // job closes forgotten day shifts.
  const open = record?.clockIn
    ? record
    : isOvernight(shift) && previous?.clockIn && !previous.clockOut
      ? previous
      : null;
  return { shift, day, record, open };
};

const clockIn = async (employeeId, now = nowTz()) => {
  const db = require("../models");
  try {
    return await db.sequelize.transaction(async (transaction) => {
      const { shift, day, record } = await loadClockState(employeeId, now, { transaction, lock: true });
      if (record?.clockIn) {
        throw new AppError("You have already clocked in for this shift", 409, "ALREADY_CLOCKED_IN");
      }
      const status = isLate(shift, day, now) ? "Late" : "Present";
      const clockInAt = now.toDate();
      if (record) {
        // e.g. the Half-day record an approved half-day leave created
        return record.update(
          { clockIn: clockInAt, status: record.status === "Half-day" ? "Half-day" : status },
          { transaction },
        );
      }
      return db.AttendanceRecord.create(
        { employeeId, date: day, clockIn: clockInAt, status },
        { transaction },
      );
    });
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      throw new AppError("You have already clocked in for this shift", 409, "ALREADY_CLOCKED_IN");
    }
    throw err;
  }
};

const clockOut = async (employeeId, now = nowTz()) => {
  const db = require("../models");
  return db.sequelize.transaction(async (transaction) => {
    const { open } = await loadClockState(employeeId, now, { transaction, lock: true });
    if (!open) {
      throw new AppError("You need to clock in before clocking out", 400, "NOT_CLOCKED_IN");
    }
    if (open.clockOut) {
      throw new AppError("You have already clocked out for this shift", 409, "ALREADY_CLOCKED_OUT");
    }
    return open.update({ clockOut: now.toDate() }, { transaction });
  });
};

const clockStatus = async (employeeId, now = nowTz()) => {
  const { shift, day, record, open } = await loadClockState(employeeId, now);
  return {
    shiftDay: day,
    shift: { name: shift.name, startTime: shift.startTime, endTime: shift.endTime },
    record,
    canClockIn: !record?.clockIn,
    canClockOut: Boolean(open && !open.clockOut),
  };
};

module.exports = {
  shiftWindow,
  markHalfDay,
  clockIn,
  clockOut,
  clockStatus,
};
