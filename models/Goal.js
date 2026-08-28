const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Goal = sequelize.define(
  "Goal",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    employeeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    // NOTE: references users(id), not employees(id) — per phases/SQL_Script.txt.
    // Every other "manager" relationship in this schema (employees.manager_id)
    // points at employees, but this one points at the manager's user account.
    // This is intentional per the authoritative schema, not an oversight —
    // controllers in the Performance Reviews phase need to be aware a Goal's
    // manager is a User, not an Employee record.
    managerId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    numericTarget: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    targetDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    actualValue: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    percentComplete: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
  },
  {
    tableName: "goals",
    timestamps: true,
  },
);

module.exports = Goal;
