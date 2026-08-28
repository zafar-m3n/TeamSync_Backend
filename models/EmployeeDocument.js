const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const EmployeeDocument = sequelize.define(
  "EmployeeDocument",
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
    docName: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    filePath: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    uploadDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
  },
  {
    tableName: "employee_documents",
    timestamps: true,
  },
);

module.exports = EmployeeDocument;
