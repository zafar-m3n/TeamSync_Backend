const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.NODE_TEAMSYNC_DB_NAME,
  process.env.NODE_TEAMSYNC_DB_USER,
  process.env.NODE_TEAMSYNC_DB_PASSWORD,
  {
    host: process.env.NODE_TEAMSYNC_DB_HOST,
    port: process.env.NODE_TEAMSYNC_DB_PORT,
    dialect: "mysql",
    logging: false,
    define: {
      underscored: true,
      timestamps: true,
    },
  },
);

const testConnection = async () => {
  await sequelize.authenticate();
};

module.exports = { sequelize, Sequelize, testConnection };
