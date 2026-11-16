const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const hideAttributes = require("../utils/hideAttributes");

const TrainingDocument = sequelize.define(
  "TrainingDocument",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    filePath: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    originalName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    categoryId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    uploadedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
  },
  {
    tableName: "training_documents",
    timestamps: true,
    paranoid: true,
  },
);

hideAttributes(TrainingDocument, ["filePath"], "withFilePath");

module.exports = TrainingDocument;
