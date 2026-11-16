"use strict";

// attendance.clock: allowed for the base roles, denied for custom roles (as new
// custom roles start). The seed only adds missing rows, so existing databases need this.
module.exports = {
  up: (queryInterface) =>
    queryInterface.sequelize.query(
      `INSERT IGNORE INTO permissions (role_id, module, action, allowed)
       SELECT id, 'attendance', 'clock', NOT is_custom FROM roles`,
    ),
  down: (queryInterface) =>
    queryInterface.sequelize.query(
      "DELETE FROM permissions WHERE module = 'attendance' AND action = 'clock'",
    ),
};
