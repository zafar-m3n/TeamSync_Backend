const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Shift = sequelize.define(
  "Shift",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    startTime: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    endTime: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    gracePeriodMinutes: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    workingDays: {
      type: DataTypes.JSON,
      allowNull: false,
    },
  },
  {
    tableName: "shifts",
    timestamps: true,
  },
);

module.exports = Shift;
