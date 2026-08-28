const db = require("../models");
const { Op } = db.Sequelize;
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");
const { sendSuccess } = require("../utils/apiResponse");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");

const createDepartment = catchAsync(async (req, res) => {
  const { name, departmentHeadId } = req.body;

  if (departmentHeadId != null) {
    const employee = await db.Employee.findByPk(departmentHeadId);
    if (!employee) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }
  }

  const department = await db.Department.create({ name, departmentHeadId });
  return sendSuccess(res, 201, department);
});

const listDepartments = catchAsync(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);

  const where = {};
  if (req.query.search) {
    where.name = { [Op.like]: `%${req.query.search}%` };
  }

  const { rows, count } = await db.Department.findAndCountAll({
    where,
    limit,
    offset,
    order: [["name", "ASC"]],
    include: [{ association: "departmentHead", attributes: ["id", "fullName"] }],
  });

  return sendSuccess(res, 200, rows, buildPaginationMeta(page, limit, count));
});

const getDepartment = catchAsync(async (req, res) => {
  const department = await db.Department.findByPk(req.params.id, {
    include: "departmentHead",
  });

  if (!department) {
    throw new AppError("Department not found", 404, "NOT_FOUND");
  }

  return sendSuccess(res, 200, department);
});

const updateDepartment = catchAsync(async (req, res) => {
  const department = await db.Department.findByPk(req.params.id);

  if (!department) {
    throw new AppError("Department not found", 404, "NOT_FOUND");
  }

  const { departmentHeadId } = req.body;
  if (departmentHeadId != null) {
    const employee = await db.Employee.findByPk(departmentHeadId);
    if (!employee) {
      throw new AppError("Employee not found", 404, "EMPLOYEE_NOT_FOUND");
    }
  }

  await department.update(req.body);
  return sendSuccess(res, 200, department);
});

const deleteDepartment = catchAsync(async (req, res) => {
  const department = await db.Department.findByPk(req.params.id);

  if (!department) {
    throw new AppError("Department not found", 404, "NOT_FOUND");
  }

  const employeeCount = await db.Employee.count({ where: { departmentId: department.id } });
  if (employeeCount > 0) {
    throw new AppError(
      "Cannot delete a department with employees assigned. Reassign them first.",
      409,
      "DEPARTMENT_HAS_EMPLOYEES",
    );
  }

  await department.destroy();
  return sendSuccess(res, 200, { message: "Department deleted" });
});

module.exports = {
  createDepartment,
  listDepartments,
  getDepartment,
  updateDepartment,
  deleteDepartment,
};
