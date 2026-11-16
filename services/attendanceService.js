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

module.exports = { markHalfDay };
