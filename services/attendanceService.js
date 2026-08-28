const markHalfDay = async (employeeId, dateStr) => {
  const db = require("../models");

  const [record] = await db.AttendanceRecord.findOrCreate({
    where: { employeeId, date: dateStr },
    defaults: { status: "Half-day", isManualOverride: true },
  });

  if (record.status !== "Half-day") {
    await record.update({ status: "Half-day", isManualOverride: true });
  }

  return record;
};

module.exports = { markHalfDay };
