const logger = require("../utils/logger");
const AppError = require("../utils/AppError");

const errorHandler = (err, req, res, next) => {
  let error = err;

  if (err.name === "SequelizeUniqueConstraintError") {
    error = new AppError(
      "That value belongs to an existing or deleted record",
      409,
      "DUPLICATE_VALUE",
    );
  } else if (err.name === "SequelizeValidationError") {
    const details = err.errors.map((e) => ({ field: e.path || "", message: e.message }));
    error = new AppError("Validation failed", 400, "VALIDATION_ERROR", details);
  } else if (!(error instanceof AppError)) {
    logger.error(`Unhandled error: ${err.message}`);
    if (process.env.NODE_TEAMSYNC_NODE_ENV === "development") {
      console.error(err.stack);
    }
    error = new AppError("Something went wrong", 500, "INTERNAL_ERROR");
  } else {
    logger.warn(`${error.statusCode} ${error.code || ""}: ${error.message}`);
  }

  const response = {
    success: false,
    error: {
      message: error.message,
      code: error.code,
    },
  };

  if (error.details) {
    response.error.details = error.details;
  }

  if (process.env.NODE_TEAMSYNC_NODE_ENV === "development" && !(err instanceof AppError)) {
    response.error.stack = err.stack;
  }

  res.status(error.statusCode).json(response);
};

module.exports = errorHandler;
