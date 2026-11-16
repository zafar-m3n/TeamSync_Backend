"use strict";

// goals.delete: allowed for Manager (own goals) and HR/Admin (any goal), denied for
// Employee and custom roles. The seed only adds missing rows, so existing databases need this.
module.exports = {
  up: (queryInterface) =>
    queryInterface.sequelize.query(
      `INSERT IGNORE INTO permissions (role_id, module, action, allowed)
       SELECT id, 'goals', 'delete', NOT is_custom AND name IN ('Manager', 'HR', 'Admin') FROM roles`,
    ),
  down: (queryInterface) =>
    queryInterface.sequelize.query(
      "DELETE FROM permissions WHERE module = 'goals' AND action = 'delete'",
    ),
};
