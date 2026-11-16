"use strict";

// Org-wide holidays calendar: one row per date.
module.exports = {
  up: (queryInterface) =>
    queryInterface.sequelize.query(
      `CREATE TABLE holidays (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        date DATE NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_holidays_date (date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
    ),
  down: (queryInterface) => queryInterface.sequelize.query("DROP TABLE holidays"),
};
