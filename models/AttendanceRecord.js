const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const AttendanceRecord = sequelize.define(
  "AttendanceRecord",
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
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    clockIn: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    clockOut: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("Present", "Late", "Half-day", "Absent"),
      allowNull: false,
      defaultValue: "Absent",
    },
    isManualOverride: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    overriddenBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
  },
  {
    tableName: "attendance_records",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["employee_id", "date"],
      },
    ],
  },
);

module.exports = AttendanceRecord;
