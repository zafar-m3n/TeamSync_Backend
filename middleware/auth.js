const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

const verifyToken = catchAsync(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
  }

  const token = authHeader.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.NODE_TEAMSYNC_JWT_SECRET);
  } catch (err) {
    throw new AppError("Invalid or expired token", 401, "INVALID_TOKEN");
  }

  req.user = {
    id: decoded.userId,
    roleId: decoded.roleId,
    roleName: decoded.roleName,
  };

  next();
});

module.exports = { verifyToken };
