const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const EmployeeBanking = sequelize.define(
  "EmployeeBanking",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    employeeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      unique: true,
    },
    bankName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    accountHolderName: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    accountNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    bankBranch: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    tableName: "employee_banking",
    timestamps: true,
  },
);

module.exports = EmployeeBanking;
