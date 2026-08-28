const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const EmployeeContact = sequelize.define(
  "EmployeeContact",
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
    addressLine1: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    addressLine2: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    postalCode: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    emergencyContactName: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    emergencyContactRelationship: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    emergencyContactPhone: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
  },
  {
    tableName: "employee_contacts",
    timestamps: true,
  },
);

module.exports = EmployeeContact;
