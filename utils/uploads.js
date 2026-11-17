const fs = require("fs");
const path = require("path");
const AppError = require("./AppError");
const logger = require("./logger");

const UPLOADS_ROOT = path.resolve(__dirname, "..", "uploads");

const notFound = () => new AppError("File not found", 404, "FILE_NOT_FOUND");

// Resolves a stored path (following symlinks) and refuses anything outside uploads/.
const resolveUploadPath = async (storedPath) => {
  let real;
  let root;
  try {
    [real, root] = await Promise.all([
      fs.promises.realpath(path.resolve(storedPath)),
      fs.promises.realpath(UPLOADS_ROOT),
    ]);
  } catch {
    throw notFound();
  }

  const relative = path.relative(root, real);
  const inside = relative !== "" && relative.split(path.sep)[0] !== ".." && !path.isAbsolute(relative);
  if (!inside) {
    logger.warn(`Refused to serve a file outside uploads/: ${storedPath}`);
    throw notFound();
  }

  const stat = await fs.promises.stat(real);
  if (!stat.isFile()) {
    throw notFound();
  }
  return real;
};

// Streams a stored document as an attachment under its original name.
const sendUpload = async (res, { filePath, originalName, mimeType }) => {
  const resolved = await resolveUploadPath(filePath);

  await new Promise((resolve, reject) => {
    res.download(
      resolved,
      originalName,
      { headers: { "Content-Type": mimeType, "X-Content-Type-Options": "nosniff" } },
      (err) => {
        if (!err) return resolve();
        if (res.headersSent) {
          logger.warn(`Download interrupted for ${resolved}: ${err.message}`);
          return resolve();
        }
        return reject(err.code === "ENOENT" ? notFound() : err);
      },
    );
  });
};

module.exports = { UPLOADS_ROOT, sendUpload };
