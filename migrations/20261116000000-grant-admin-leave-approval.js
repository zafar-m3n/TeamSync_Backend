"use strict";

// Existing databases already hold Admin's leave.approve / leave.cancel_approved rows as
// denied, and the seed never updates existing rows. A fresh database gets them from the
// permission matrix when seeded, so this is a no-op there.
const setAllowed = (queryInterface, allowed) =>
  queryInterface.sequelize.query(
    `UPDATE permissions p
       JOIN roles r ON r.id = p.role_id
        SET p.allowed = :allowed
      WHERE r.name = 'Admin'
        AND p.module = 'leave'
        AND p.action IN ('approve', 'cancel_approved')`,
    { replacements: { allowed } },
  );

module.exports = {
  up: (queryInterface) => setAllowed(queryInterface, true),
  down: (queryInterface) => setAllowed(queryInterface, false),
};
