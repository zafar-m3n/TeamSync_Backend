require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("../models");
const logger = require("../utils/logger");

const BASE_ROLES = [
  {
    name: "Admin",
    isCustom: false,
    description: "Full system access, including permission configuration and role management",
  },
  {
    name: "HR",
    isCustom: false,
    description: "Manages employee records, leave, attendance corrections, shifts, and leave types",
  },
  {
    name: "Manager",
    isCustom: false,
    description: "Manages direct reports — approves leave, sets performance goals, assigns training",
  },
  {
    name: "Employee",
    isCustom: false,
    description: "Standard user — views own records, submits leave, views assigned training and goals",
  },
];

const run = async () => {
  try {
    await db.sequelize.authenticate();

    for (const roleData of BASE_ROLES) {
      await db.Role.findOrCreate({ where: { name: roleData.name }, defaults: roleData });
    }
    logger.success("Base roles ensured (Admin, HR, Manager, Employee)");

    const adminRole = await db.Role.findOne({ where: { name: "Admin" } });

    const adminEmail = process.env.NODE_TEAMSYNC_SEED_ADMIN_EMAIL;
    const adminPassword = process.env.NODE_TEAMSYNC_SEED_ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      throw new Error("NODE_TEAMSYNC_SEED_ADMIN_EMAIL and NODE_TEAMSYNC_SEED_ADMIN_PASSWORD must be set in .env");
    }

    const existingAdmin = await db.User.findOne({ where: { email: adminEmail } });

    if (existingAdmin) {
      logger.info(`Admin user ${adminEmail} already exists — skipping`);
    } else {
      const saltRounds = parseInt(process.env.NODE_TEAMSYNC_BCRYPT_SALT_ROUNDS, 10) || 10;
      const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

      await db.User.create({
        email: adminEmail,
        passwordHash,
        roleId: adminRole.id,
        isActive: true,
      });
      logger.success(`Initial Admin user created: ${adminEmail}`);
    }

    process.exit(0);
  } catch (err) {
    logger.error(`Seed failed: ${err.message}`);
    process.exit(1);
  }
};

run();
