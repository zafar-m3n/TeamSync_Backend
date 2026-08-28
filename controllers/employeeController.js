const fs = require("fs");
const bcrypt = require("bcryptjs");
const db = require("../models");
const { Op } = db.Sequelize;
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const { sendEmail } = require("../utils/email");
const hasPermission = require("../utils/hasPermission");

const DETAIL_INCLUDES = ["department", "shift", "manager", "contact", "banking", "documents"];

const limitedShape = (employee) => ({
  id: employee.id,
  fullName: employee.fullName,
  department: employee.department,
  designation: employee.designation,
});

const assertReferencesExist = async ({ departmentId, shiftId, managerId }) => {
  if (departmentId != null) {
    const department = await db.Department.findByPk(departmentId);
    if (!department) {
      throw new AppError("Department not found", 404, "DEPARTMENT_NOT_FOUND");
    }
  }
  if (shiftId != null) {
    const shift = await db.Shift.findByPk(shiftId);
    if (!shift) {
      throw new AppError("Shift not found", 404, "SHIFT_NOT_FOUND");
    }
  }
  if (managerId != null) {
    const manager = await db.Employee.findByPk(managerId);
    if (!manager) {
      throw new AppError("Manager not found", 404, "MANAGER_NOT_FOUND");
    }
  }
};

const createEmployee = catchAsync(async (req, res) => {
  const {
    email,
    initialPassword,
    roleId,
    employeeCode,
    contact,
    banking,
    ...basicAndEmployment
  } = req.body;

  const emailTaken = await db.User.findOne({ where: { email } });
  if (emailTaken) {
    throw new AppError("Email already in use", 409, "EMAIL_TAKEN");
  }

  const codeTaken = await db.Employee.findOne({ where: { employeeCode } });
  if (codeTaken) {
    throw new AppError("Employee code already in use", 409, "EMPLOYEE_CODE_TAKEN");
  }

  await assertReferencesExist(basicAndEmployment);

  const saltRounds = parseInt(process.env.NODE_TEAMSYNC_BCRYPT_SALT_ROUNDS, 10) || 10;
  const passwordHash = await bcrypt.hash(initialPassword, saltRounds);

  const { employee, user } = await db.sequelize.transaction(async (t) => {
    const createdUser = await db.User.create(
      { email, passwordHash, roleId, isActive: true },
      { transaction: t },
    );

    const createdEmployee = await db.Employee.create(
      { ...basicAndEmployment, employeeCode, userId: createdUser.id },
      { transaction: t },
    );

    if (contact) {
      await db.EmployeeContact.create({ ...contact, employeeId: createdEmployee.id }, { transaction: t });
    }
    if (banking) {
      await db.EmployeeBanking.create({ ...banking, employeeId: createdEmployee.id }, { transaction: t });
    }

    return { employee: createdEmployee, user: createdUser };
  });

  const loginUrl = process.env.NODE_TEAMSYNC_CLIENT_URL;
  sendEmail({
    to: email,
    subject: "Welcome to TeamSync",
    text: `Hi ${employee.fullName},\n\nYour TeamSync account has been created. You can sign in at ${loginUrl} using your work email. Your administrator has set your initial password separately.\n\n— TeamSync`,
    html: `<p>Hi ${employee.fullName},</p><p>Your TeamSync account has been created. You can sign in at <a href="${loginUrl}">${loginUrl}</a> using your work email. Your administrator has set your initial password separately.</p><p>— TeamSync</p>`,
  });

  return sendSuccess(res, 201, {
    employee,
    user: { id: user.id, email: user.email, roleId: user.roleId },
  });
});

const listEmployees = catchAsync(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);

  const where = {};
  if (req.query.departmentId !== undefined) {
    where.departmentId = req.query.departmentId;
  }
  if (req.query.search) {
    where[Op.or] = [
      { fullName: { [Op.like]: `%${req.query.search}%` } },
      { employeeCode: { [Op.like]: `%${req.query.search}%` } },
    ];
  }

  const { rows, count } = await db.Employee.findAndCountAll({
    where,
    limit,
    offset,
    order: [["fullName", "ASC"]],
    include: ["department", "shift"],
  });

  return sendSuccess(res, 200, rows, buildPaginationMeta(page, limit, count));
});

const getMyProfile = catchAsync(async (req, res) => {
  const employee = await db.Employee.findOne({
    where: { userId: req.user.id },
    include: DETAIL_INCLUDES,
  });

  if (!employee) {
    throw new AppError("No employee profile linked to this account", 404, "NO_EMPLOYEE_PROFILE");
  }

  return sendSuccess(res, 200, employee);
});

const getTeam = catchAsync(async (req, res) => {
  const requester = await db.Employee.findOne({ where: { userId: req.user.id } });

  if (!requester) {
    throw new AppError("No employee profile linked to this account", 404, "NO_EMPLOYEE_PROFILE");
  }

  const reports = await db.Employee.findAll({
    where: { managerId: requester.id },
    include: ["department"],
  });

  return sendSuccess(res, 200, reports.map(limitedShape));
});

const getEmployeeById = catchAsync(async (req, res) => {
  const target = await db.Employee.findByPk(req.params.id, { include: DETAIL_INCLUDES });

  if (!target) {
    throw new AppError("Employee not found", 404, "NOT_FOUND");
  }

  const canViewAll = await hasPermission(req.user.roleId, "employees", "view_all");
  if (canViewAll) {
    return sendSuccess(res, 200, target);
  }

  const requester = await db.Employee.findOne({ where: { userId: req.user.id } });

  const canViewTeam = await hasPermission(req.user.roleId, "employees", "view_team");
  if (canViewTeam && requester && target.managerId === requester.id) {
    return sendSuccess(res, 200, limitedShape(target));
  }

  const canViewOwn = await hasPermission(req.user.roleId, "employees", "view_own");
  if (canViewOwn && requester && target.id === requester.id) {
    return sendSuccess(res, 200, target);
  }

  throw new AppError("You do not have permission to view this employee", 403, "FORBIDDEN");
});

const updateEmployee = catchAsync(async (req, res) => {
  const { email, contact, banking, ...employeeFields } = req.body;

  const employee = await db.Employee.findByPk(req.params.id, { include: ["user"] });

  if (!employee) {
    throw new AppError("Employee not found", 404, "NOT_FOUND");
  }

  if (email && email !== employee.user.email) {
    const emailTaken = await db.User.findOne({ where: { email, id: { [Op.ne]: employee.userId } } });
    if (emailTaken) {
      throw new AppError("Email already in use", 409, "EMAIL_TAKEN");
    }
  }

  if (employeeFields.employeeCode && employeeFields.employeeCode !== employee.employeeCode) {
    const codeTaken = await db.Employee.findOne({
      where: { employeeCode: employeeFields.employeeCode, id: { [Op.ne]: employee.id } },
    });
    if (codeTaken) {
      throw new AppError("Employee code already in use", 409, "EMPLOYEE_CODE_TAKEN");
    }
  }

  await assertReferencesExist(employeeFields);

  await db.sequelize.transaction(async (t) => {
    if (email) {
      await employee.user.update({ email }, { transaction: t });
    }

    await employee.update(employeeFields, { transaction: t });

    if (contact) {
      const [row, created] = await db.EmployeeContact.findOrCreate({
        where: { employeeId: employee.id },
        defaults: { ...contact, employeeId: employee.id },
        transaction: t,
      });
      if (!created) {
        await row.update(contact, { transaction: t });
      }
    }

    if (banking) {
      const [row, created] = await db.EmployeeBanking.findOrCreate({
        where: { employeeId: employee.id },
        defaults: { ...banking, employeeId: employee.id },
        transaction: t,
      });
      if (!created) {
        await row.update(banking, { transaction: t });
      }
    }
  });

  const updated = await db.Employee.findByPk(employee.id, {
    include: [...DETAIL_INCLUDES, "user"],
  });

  return sendSuccess(res, 200, updated);
});

const uploadDocument = catchAsync(async (req, res) => {
  const employee = await db.Employee.findByPk(req.params.id);

  if (!employee) {
    throw new AppError("Employee not found", 404, "NOT_FOUND");
  }

  if (!req.file) {
    throw new AppError("A file is required", 400, "FILE_REQUIRED");
  }

  const document = await db.EmployeeDocument.create({
    employeeId: employee.id,
    docName: req.body.docName,
    filePath: req.file.path,
    uploadDate: new Date(),
  });

  return sendSuccess(res, 201, document);
});

const deleteDocument = catchAsync(async (req, res) => {
  const document = await db.EmployeeDocument.findByPk(req.params.documentId);

  if (!document || String(document.employeeId) !== String(req.params.id)) {
    throw new AppError("Document not found", 404, "NOT_FOUND");
  }

  const { filePath } = document;
  await document.destroy();

  fs.unlink(filePath, () => {
    // Best-effort cleanup — a missing file must not fail the request.
  });

  return sendSuccess(res, 200, { message: "Document deleted" });
});

const assignShift = catchAsync(async (req, res) => {
  const employee = await db.Employee.findByPk(req.params.id);

  if (!employee) {
    throw new AppError("Employee not found", 404, "NOT_FOUND");
  }

  const { shiftId } = req.body;

  if (shiftId != null) {
    const shift = await db.Shift.findByPk(shiftId);
    if (!shift) {
      throw new AppError("Shift not found", 404, "SHIFT_NOT_FOUND");
    }
  }

  employee.shiftId = shiftId;
  await employee.save();

  return sendSuccess(res, 200, employee);
});

module.exports = {
  createEmployee,
  listEmployees,
  getMyProfile,
  getTeam,
  getEmployeeById,
  updateEmployee,
  uploadDocument,
  deleteDocument,
  assignShift,
};
