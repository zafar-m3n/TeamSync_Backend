const fs = require("fs");
const bcrypt = require("bcryptjs");
const db = require("../models");
const { Op } = db.Sequelize;
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess, sendDeleted } = require("../utils/apiResponse");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const hasPermission = require("../utils/hasPermission");
const isValueTaken = require("../utils/isValueTaken");
const { getRequesterEmployee } = require("../services/requesterService");
const { assertCanAssignRole } = require("../services/roleRankService");

const DETAIL_INCLUDES = [
  "department",
  "shift",
  "manager",
  "contact",
  "banking",
  "documents",
  { association: "user", attributes: { exclude: ["passwordHash"] }, include: ["role"] },
];

const limitedShape = (employee) => ({
  id: employee.id,
  fullName: employee.fullName,
  department: employee.department,
  designation: employee.designation,
});

// email and role live on the linked User, not on Employee — flatten them onto the
// employee object so the response matches the shape the frontend expects.
const fullShape = (employee) => {
  const plain = employee.get({ plain: true });
  plain.email = plain.user ? plain.user.email : null;
  plain.role = plain.user ? plain.user.role : null;
  return plain;
};

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

  await assertCanAssignRole(req, roleId);

  if (await isValueTaken(db.User, "email", email)) {
    throw new AppError(
      "Email belongs to an existing or deleted account",
      409,
      "EMAIL_TAKEN",
    );
  }

  if (await isValueTaken(db.Employee, "employeeCode", employeeCode)) {
    throw new AppError(
      "Employee code belongs to an existing or deleted employee",
      409,
      "EMPLOYEE_CODE_TAKEN",
    );
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

  return sendSuccess(res, 200, fullShape(employee));
});

const getTeam = catchAsync(async (req, res) => {
  const requester = await getRequesterEmployee(req);

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
    return sendSuccess(res, 200, fullShape(target));
  }

  const requester = await getRequesterEmployee(req, { required: false });

  const canViewTeam = await hasPermission(req.user.roleId, "employees", "view_team");
  if (canViewTeam && requester && target.managerId === requester.id) {
    return sendSuccess(res, 200, limitedShape(target));
  }

  const canViewOwn = await hasPermission(req.user.roleId, "employees", "view_own");
  if (canViewOwn && requester && target.id === requester.id) {
    return sendSuccess(res, 200, fullShape(target));
  }

  throw new AppError("You do not have permission to view this employee", 403, "FORBIDDEN");
});

const updateEmployee = catchAsync(async (req, res) => {
  const { email, roleId, contact, banking, ...employeeFields } = req.body;

  const employee = await db.Employee.findByPk(req.params.id, { include: ["user"] });

  if (!employee) {
    throw new AppError("Employee not found", 404, "NOT_FOUND");
  }

  const roleChanged = roleId !== undefined && roleId !== employee.user.roleId;
  if (roleChanged) {
    await assertCanAssignRole(req, roleId);
  }

  if (email && email !== employee.user.email) {
    if (await isValueTaken(db.User, "email", email, { excludeId: employee.userId })) {
      throw new AppError(
        "Email belongs to an existing or deleted account",
        409,
        "EMAIL_TAKEN",
      );
    }
  }

  if (employeeFields.employeeCode && employeeFields.employeeCode !== employee.employeeCode) {
    if (
      await isValueTaken(db.Employee, "employeeCode", employeeFields.employeeCode, {
        excludeId: employee.id,
      })
    ) {
      throw new AppError(
        "Employee code belongs to an existing or deleted employee",
        409,
        "EMPLOYEE_CODE_TAKEN",
      );
    }
  }

  await assertReferencesExist(employeeFields);

  await db.sequelize.transaction(async (t) => {
    if (email) {
      await employee.user.update({ email }, { transaction: t });
    }

    if (roleChanged) {
      await employee.user.update({ roleId }, { transaction: t });
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

  const updated = await db.Employee.findByPk(employee.id, { include: DETAIL_INCLUDES });

  return sendSuccess(res, 200, fullShape(updated));
});

// Soft delete (Employee and User are both paranoid). The employee and their login
// account are archived and hidden from every read; all history — attendance, leave,
// goals, training, banking — keeps its foreign keys and stays intact. Not reversible
// from the API. Blocked while the employee still anchors other live records.
const deleteEmployee = catchAsync(async (req, res) => {
  const employee = await db.Employee.findByPk(req.params.id, { include: ["user"] });

  if (!employee) {
    throw new AppError("Employee not found", 404, "NOT_FOUND");
  }

  if (req.user.id === employee.userId) {
    throw new AppError("You cannot delete your own account", 400, "CANNOT_DELETE_SELF");
  }

  const reportCount = await db.Employee.count({ where: { managerId: employee.id } });
  if (reportCount > 0) {
    throw new AppError(
      "Cannot delete an employee who still manages direct reports. Reassign them first.",
      409,
      "EMPLOYEE_HAS_REPORTS",
    );
  }

  const headedCount = await db.Department.count({ where: { departmentHeadId: employee.id } });
  if (headedCount > 0) {
    throw new AppError(
      "Cannot delete an employee who still heads a department. Reassign the department head first.",
      409,
      "EMPLOYEE_IS_DEPARTMENT_HEAD",
    );
  }

  const pendingLeaveCount = await db.LeaveRequest.count({
    where: { employeeId: employee.id, status: "Pending" },
  });
  if (pendingLeaveCount > 0) {
    throw new AppError(
      "Cannot delete an employee with pending leave requests. Resolve them first.",
      409,
      "EMPLOYEE_HAS_PENDING_LEAVE",
    );
  }

  await db.sequelize.transaction(async (t) => {
    if (employee.user) {
      await employee.user.update({ isActive: false }, { transaction: t });
      await employee.user.destroy({ transaction: t });
    }
    await employee.destroy({ transaction: t });
  });

  return sendDeleted(res, employee.id, "Employee deleted");
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

  return sendDeleted(res, document.id, "Document deleted");
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
  deleteEmployee,
  uploadDocument,
  deleteDocument,
  assignShift,
};
