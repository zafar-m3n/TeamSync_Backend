const multer = require("multer");
const path = require("path");
const fs = require("fs");
const AppError = require("../utils/AppError");
const { UPLOADS_ROOT } = require("../utils/uploads");

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
];

const createUploader = (subfolder) => {
  const destination = path.join(UPLOADS_ROOT, subfolder);

  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, destination),
    filename: (req, file, cb) => {
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      cb(null, `${Date.now()}-${sanitizedName}`);
    },
  });

  const fileFilter = (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new AppError("Unsupported file type", 400, "INVALID_FILE_TYPE"));
    }
    cb(null, true);
  };

  const maxSizeBytes = (parseInt(process.env.NODE_TEAMSYNC_UPLOAD_MAX_SIZE_MB, 10) || 5) * 1024 * 1024;

  return multer({
    storage,
    fileFilter,
    // Browsers send non-ASCII file names as UTF-8.
    defParamCharset: "utf8",
    limits: { fileSize: maxSizeBytes },
  });
};

module.exports = { createUploader };
