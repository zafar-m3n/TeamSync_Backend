const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

const verifyToken = catchAsync(async (req, res, next) => {
  const db = require("../models");
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

  const user = await db.User.findByPk(decoded.userId);

  if (!user || !user.isActive) {
    throw new AppError("Account is inactive or no longer exists", 401, "ACCOUNT_INACTIVE");
  }

  req.user = {
    id: user.id,
    roleId: user.roleId,
    roleName: decoded.roleName,
  };

  next();
});

module.exports = { verifyToken };
