const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Employee = sequelize.define(
  "Employee",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      unique: true,
    },
    employeeCode: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
    },
    fullName: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    dob: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    gender: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    departmentId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    designation: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    dateOfJoining: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    employmentType: {
      type: DataTypes.ENUM("Full-time", "Part-time", "Contract", "Intern", "Probation"),
      allowNull: false,
      defaultValue: "Full-time",
    },
    shiftId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    managerId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
  },
  {
    tableName: "employees",
    timestamps: true,
    paranoid: true,
  },
);

module.exports = Employee;
