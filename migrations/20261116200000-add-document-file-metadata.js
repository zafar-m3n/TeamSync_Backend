"use strict";

// The original file name and content type, sent back on download.
const TABLES = ["employee_documents", "training_documents"];

module.exports = {
  up: async (queryInterface) => {
    for (const table of TABLES) {
      await queryInterface.sequelize.query(
        `ALTER TABLE ${table}
          ADD COLUMN original_name VARCHAR(255) NOT NULL AFTER file_path,
          ADD COLUMN mime_type VARCHAR(100) NOT NULL AFTER original_name`,
      );
    }
  },
  down: async (queryInterface) => {
    for (const table of TABLES) {
      await queryInterface.sequelize.query(
        `ALTER TABLE ${table} DROP COLUMN mime_type, DROP COLUMN original_name`,
      );
    }
  },
};
