"use strict";

// A document can be assigned to an employee once and to a department once.
// NULLs don't collide in a unique index, so an employee-only row never blocks a
// department-only row and vice versa.
module.exports = {
  up: (queryInterface) =>
    queryInterface.sequelize.query(
      `ALTER TABLE training_assignments
        ADD UNIQUE INDEX uq_training_assignments_document_employee (document_id, employee_id),
        ADD UNIQUE INDEX uq_training_assignments_document_department (document_id, department_id)`,
    ),
  down: (queryInterface) =>
    queryInterface.sequelize.query(
      `ALTER TABLE training_assignments
        DROP INDEX uq_training_assignments_document_employee,
        DROP INDEX uq_training_assignments_document_department`,
    ),
};
