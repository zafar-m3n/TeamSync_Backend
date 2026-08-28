const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const LeaveBalance = sequelize.define(
  "LeaveBalance",
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
    year: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false,
    },
    totalDays: {
      type: DataTypes.DECIMAL(5, 1),
      allowNull: false,
      defaultValue: 0,
    },
    usedDays: {
      type: DataTypes.DECIMAL(5, 1),
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "leave_balances",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["employee_id", "year"],
      },
    ],
  },
);

module.exports = LeaveBalance;
