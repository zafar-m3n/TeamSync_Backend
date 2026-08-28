require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("../models");
const logger = require("../utils/logger");
const { PERMISSION_MATRIX } = require("../constants/permissionMatrix");

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

    const allRoles = await db.Role.findAll({ where: { name: BASE_ROLES.map((r) => r.name) } });
    const roleByName = Object.fromEntries(allRoles.map((r) => [r.name, r]));

    let permissionCount = 0;
    for (const entry of PERMISSION_MATRIX) {
      for (const roleName of Object.keys(roleByName)) {
        const role = roleByName[roleName];
        const allowed = entry.roles.includes(roleName);
        await db.Permission.findOrCreate({
          where: { roleId: role.id, module: entry.module, action: entry.action },
          defaults: { allowed },
        });
        permissionCount += 1;
      }
    }
    logger.success(`Default permission matrix ensured (${permissionCount} role/module/action rows checked)`);

    process.exit(0);
  } catch (err) {
    logger.error(`Seed failed: ${err.message}`);
    process.exit(1);
  }
};

run();
