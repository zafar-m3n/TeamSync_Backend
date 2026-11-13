const { Sequelize } = require("sequelize");
const dbSettings = require("./dbSettings");

const sequelize = new Sequelize(dbSettings);

const testConnection = async () => {
  await sequelize.authenticate();
};

module.exports = { sequelize, Sequelize, testConnection };
