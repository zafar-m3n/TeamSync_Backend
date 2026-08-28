const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const TrainingAssignment = sequelize.define(
  "TrainingAssignment",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    documentId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    employeeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    departmentId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    assignedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
  },
  {
    tableName: "training_assignments",
    timestamps: true,
    validate: {
      // Mirrors the DB-level CHECK constraint (chk_training_assignments_target)
      // so a bad request fails with a clear Sequelize validation error instead
      // of a raw MySQL constraint error.
      hasTarget() {
        if (this.employeeId == null && this.departmentId == null) {
          throw new Error("A training assignment must target an employee, a department, or both.");
        }
      },
    },
  },
);

module.exports = TrainingAssignment;
