const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const { rankOf } = require("../utils/roleRank");

const Role = sequelize.define(
  "Role",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    isCustom: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    rank: {
      type: DataTypes.VIRTUAL,
      get() {
        return rankOf({ name: this.getDataValue("name"), isCustom: this.getDataValue("isCustom") });
      },
    },
  },
  {
    tableName: "roles",
    timestamps: true,
  },
);

module.exports = Role;
