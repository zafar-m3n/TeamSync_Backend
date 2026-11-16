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

  const user = await db.User.findByPk(decoded.userId, {
    include: [{ model: db.Role, as: "role" }],
  });

  if (!user || !user.isActive) {
    throw new AppError("Account is inactive or no longer exists", 401, "ACCOUNT_INACTIVE");
  }

  // Tokens issued before token versions existed carry no `tv` and count as version 0.
  if ((decoded.tv ?? 0) !== user.tokenVersion) {
    throw new AppError("Session has ended, please log in again", 401, "TOKEN_REVOKED");
  }

  req.user = {
    id: user.id,
    roleId: user.roleId,
    roleName: user.role ? user.role.name : null,
  };

  next();
});

module.exports = { verifyToken };
