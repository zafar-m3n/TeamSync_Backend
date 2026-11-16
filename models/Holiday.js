const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Holiday = sequelize.define(
  "Holiday",
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
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      unique: true,
    },
  },
  {
    tableName: "holidays",
    timestamps: true,
  },
);

module.exports = Holiday;
