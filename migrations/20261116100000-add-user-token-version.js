"use strict";

// Bumped to revoke every token issued before it (logout, password change or reset).
module.exports = {
  up: (queryInterface) =>
    queryInterface.sequelize.query(
      "ALTER TABLE users ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER is_active",
    ),
  down: (queryInterface) => queryInterface.sequelize.query("ALTER TABLE users DROP COLUMN token_version"),
};
