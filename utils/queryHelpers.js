const { Op } = require("sequelize");

const buildDateFilter = (query) => {
  if (query.startDate && query.endDate) {
    return { [Op.between]: [query.startDate, query.endDate] };
  }
  if (query.startDate) {
    return { [Op.gte]: query.startDate };
  }
  if (query.endDate) {
    return { [Op.lte]: query.endDate };
  }
  return undefined;
};

// "assigned to this employee" = a direct assignment to them, or one to their
// department (only when they actually have a department).
const assignmentScopeOr = (employee) => {
  const conds = [{ employeeId: employee.id }];
  if (employee.departmentId != null) {
    conds.push({ departmentId: employee.departmentId });
  }
  return { [Op.or]: conds };
};

module.exports = { buildDateFilter, assignmentScopeOr };
