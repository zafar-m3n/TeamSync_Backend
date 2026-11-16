"use strict";

// Days charged to each balance year when a request is approved, e.g. {"2026": 3}.
// Cancelling refunds exactly this. Null for requests approved before this column.
module.exports = {
  up: (queryInterface) =>
    queryInterface.sequelize.query(
      "ALTER TABLE leave_requests ADD COLUMN days_by_year JSON NULL AFTER is_half_day",
    ),
  down: (queryInterface) =>
    queryInterface.sequelize.query("ALTER TABLE leave_requests DROP COLUMN days_by_year"),
};
