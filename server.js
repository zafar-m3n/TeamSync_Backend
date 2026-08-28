require("dotenv").config();
require("colors");

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const routes = require("./routes");
const errorHandler = require("./middleware/errorHandler");
const AppError = require("./utils/AppError");
const { testConnection } = require("./config/database");
const logger = require("./utils/logger");

const app = express();

app.use(cors({ origin: process.env.NODE_TEAMSYNC_CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_TEAMSYNC_NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.use("/api/v1", routes);

app.use((req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404, "NOT_FOUND"));
});

app.use(errorHandler);

const PORT = process.env.NODE_TEAMSYNC_PORT || 8080;

const start = async () => {
  try {
    await testConnection();
    logger.success("Database connection established");

    app.listen(PORT, () => {
      logger.success(`TeamSync API running on port ${PORT} [${process.env.NODE_TEAMSYNC_NODE_ENV}]`);
    });
  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }
};

start();
