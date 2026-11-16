"use strict";

// Adds employment status and termination date. "Probation" moves from employment
// type to status: those employees become Full-time with status Probation.
const TYPES = "'Full-time','Part-time','Contract','Intern'";

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.query(
      `ALTER TABLE employees
        ADD COLUMN employment_status ENUM('Active','Probation','Suspended','Resigned','Terminated')
          NOT NULL DEFAULT 'Active' AFTER employment_type,
        ADD COLUMN termination_date DATE NULL AFTER employment_status,
        ADD INDEX idx_employees_status (employment_status, termination_date)`,
    );
    await sequelize.query(
      `UPDATE employees SET employment_status = 'Probation', employment_type = 'Full-time'
       WHERE employment_type = 'Probation'`,
    );
    await sequelize.query(
      `ALTER TABLE employees MODIFY employment_type ENUM(${TYPES}) NOT NULL DEFAULT 'Full-time'`,
    );
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.query(
      `ALTER TABLE employees MODIFY employment_type ENUM(${TYPES},'Probation') NOT NULL DEFAULT 'Full-time'`,
    );
    await sequelize.query(
      "UPDATE employees SET employment_type = 'Probation' WHERE employment_status = 'Probation'",
    );
    await sequelize.query(
      `ALTER TABLE employees
        DROP INDEX idx_employees_status,
        DROP COLUMN termination_date,
        DROP COLUMN employment_status`,
    );
  },
};
