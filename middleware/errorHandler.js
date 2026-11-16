const fs = require("fs");
const multer = require("multer");
const logger = require("../utils/logger");
const AppError = require("../utils/AppError");

const MULTER_ERRORS = {
  LIMIT_FILE_SIZE: ["File exceeds the maximum upload size", "FILE_TOO_LARGE"],
  LIMIT_UNEXPECTED_FILE: ["Unexpected file field", "UNEXPECTED_FILE"],
};

// Multer stores files before validation and the controller run, so a failed
// request must remove what it uploaded.
const removeUploadedFiles = (req) => {
  const files = [req.file, ...(Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat())];
  for (const file of files) {
    if (file?.path) {
      fs.unlink(file.path, (unlinkError) => {
        if (unlinkError && unlinkError.code !== "ENOENT") {
          logger.error(`Could not remove upload ${file.path}: ${unlinkError.message}`);
        }
      });
    }
  }
};

const errorHandler = (err, req, res, next) => {
  let error = err;

  removeUploadedFiles(req);

  if (err instanceof multer.MulterError) {
    const [message, code] = MULTER_ERRORS[err.code] || [err.message, "UPLOAD_ERROR"];
    error = new AppError(message, 400, code);
  } else if (err.type === "entity.parse.failed") {
    // express.json() could not parse the request body.
    error = new AppError("Request body is not valid JSON", 400, "INVALID_JSON");
  } else if (err.name === "SequelizeUniqueConstraintError") {
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
