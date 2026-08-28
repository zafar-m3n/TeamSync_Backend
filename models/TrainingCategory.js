const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const TrainingCategory = sequelize.define(
  "TrainingCategory",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
  },
  {
    tableName: "training_categories",
    timestamps: true,
  },
);

module.exports = TrainingCategory;
