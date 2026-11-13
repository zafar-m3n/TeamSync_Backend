require("dotenv").config();

module.exports = {
  database: process.env.NODE_TEAMSYNC_DB_NAME,
  username: process.env.NODE_TEAMSYNC_DB_USER,
  password: process.env.NODE_TEAMSYNC_DB_PASSWORD,
  host: process.env.NODE_TEAMSYNC_DB_HOST,
  port: process.env.NODE_TEAMSYNC_DB_PORT,
  dialect: "mysql",
  logging: false,
  define: {
    underscored: true,
    timestamps: true,
  },
};
