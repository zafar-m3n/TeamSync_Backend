const { sequelize, Sequelize } = require("../config/database");

const Role = require("./Role");
const Department = require("./Department");
const User = require("./User");
const Shift = require("./Shift");
const Employee = require("./Employee");
const Permission = require("./Permission");
const EmployeeContact = require("./EmployeeContact");
const EmployeeBanking = require("./EmployeeBanking");
const EmployeeDocument = require("./EmployeeDocument");
const AttendanceRecord = require("./AttendanceRecord");
const LeaveType = require("./LeaveType");
const LeaveBalance = require("./LeaveBalance");
const LeaveRequest = require("./LeaveRequest");
const Goal = require("./Goal");
const TrainingCategory = require("./TrainingCategory");
const TrainingDocument = require("./TrainingDocument");
const TrainingAssignment = require("./TrainingAssignment");

// ---- Roles & Permissions ----
Role.hasMany(Permission, { foreignKey: "role_id", as: "permissions" });
Permission.belongsTo(Role, { foreignKey: "role_id", as: "role" });

Role.hasMany(User, { foreignKey: "role_id", as: "users" });
User.belongsTo(Role, { foreignKey: "role_id", as: "role" });

// ---- User <-> Employee (1:1) ----
User.hasOne(Employee, { foreignKey: "user_id", as: "employee" });
Employee.belongsTo(User, { foreignKey: "user_id", as: "user" });

// ---- Departments ----
Department.belongsTo(Employee, { foreignKey: "department_head_id", as: "departmentHead" });
Employee.hasMany(Department, { foreignKey: "department_head_id", as: "headedDepartments" });

Department.hasMany(Employee, { foreignKey: "department_id", as: "employees" });
Employee.belongsTo(Department, { foreignKey: "department_id", as: "department" });

// ---- Shifts ----
Shift.hasMany(Employee, { foreignKey: "shift_id", as: "employees" });
Employee.belongsTo(Shift, { foreignKey: "shift_id", as: "shift" });

// ---- Employee self-reference (manager / direct reports) ----
Employee.belongsTo(Employee, { foreignKey: "manager_id", as: "manager" });
Employee.hasMany(Employee, { foreignKey: "manager_id", as: "directReports" });

// ---- Employee Records sub-tables ----
Employee.hasOne(EmployeeContact, { foreignKey: "employee_id", as: "contact" });
EmployeeContact.belongsTo(Employee, { foreignKey: "employee_id", as: "employee" });

Employee.hasOne(EmployeeBanking, { foreignKey: "employee_id", as: "banking" });
EmployeeBanking.belongsTo(Employee, { foreignKey: "employee_id", as: "employee" });

Employee.hasMany(EmployeeDocument, { foreignKey: "employee_id", as: "documents" });
EmployeeDocument.belongsTo(Employee, { foreignKey: "employee_id", as: "employee" });

// ---- Attendance ----
Employee.hasMany(AttendanceRecord, { foreignKey: "employee_id", as: "attendanceRecords" });
AttendanceRecord.belongsTo(Employee, { foreignKey: "employee_id", as: "employee" });

User.hasMany(AttendanceRecord, { foreignKey: "overridden_by", as: "attendanceOverrides" });
AttendanceRecord.belongsTo(User, { foreignKey: "overridden_by", as: "overriddenByUser" });

// ---- Leave ----
Employee.hasMany(LeaveBalance, { foreignKey: "employee_id", as: "leaveBalances" });
LeaveBalance.belongsTo(Employee, { foreignKey: "employee_id", as: "employee" });

LeaveType.hasMany(LeaveRequest, { foreignKey: "leave_type_id", as: "leaveRequests" });
LeaveRequest.belongsTo(LeaveType, { foreignKey: "leave_type_id", as: "leaveType" });

Employee.hasMany(LeaveRequest, { foreignKey: "employee_id", as: "leaveRequests" });
LeaveRequest.belongsTo(Employee, { foreignKey: "employee_id", as: "employee" });

User.hasMany(LeaveRequest, { foreignKey: "approved_by", as: "leaveApprovals" });
LeaveRequest.belongsTo(User, { foreignKey: "approved_by", as: "approvedByUser" });

// ---- Performance Reviews ----
Employee.hasMany(Goal, { foreignKey: "employee_id", as: "goals" });
Goal.belongsTo(Employee, { foreignKey: "employee_id", as: "employee" });

// See the comment on Goal.managerId in models/Goal.js — this points at User,
// not Employee, per the authoritative schema.
User.hasMany(Goal, { foreignKey: "manager_id", as: "goalsManaged" });
Goal.belongsTo(User, { foreignKey: "manager_id", as: "manager" });

// ---- Training ----
TrainingCategory.hasMany(TrainingDocument, { foreignKey: "category_id", as: "documents" });
TrainingDocument.belongsTo(TrainingCategory, { foreignKey: "category_id", as: "category" });

User.hasMany(TrainingDocument, { foreignKey: "uploaded_by", as: "uploadedTrainingDocuments" });
TrainingDocument.belongsTo(User, { foreignKey: "uploaded_by", as: "uploadedByUser" });

TrainingDocument.hasMany(TrainingAssignment, { foreignKey: "document_id", as: "assignments" });
TrainingAssignment.belongsTo(TrainingDocument, { foreignKey: "document_id", as: "document" });

Employee.hasMany(TrainingAssignment, { foreignKey: "employee_id", as: "trainingAssignments" });
TrainingAssignment.belongsTo(Employee, { foreignKey: "employee_id", as: "employee" });

Department.hasMany(TrainingAssignment, { foreignKey: "department_id", as: "trainingAssignments" });
TrainingAssignment.belongsTo(Department, { foreignKey: "department_id", as: "department" });

User.hasMany(TrainingAssignment, { foreignKey: "assigned_by", as: "trainingAssignmentsMade" });
TrainingAssignment.belongsTo(User, { foreignKey: "assigned_by", as: "assignedByUser" });

const db = {
  sequelize,
  Sequelize,
  Role,
  Department,
  User,
  Shift,
  Employee,
  Permission,
  EmployeeContact,
  EmployeeBanking,
  EmployeeDocument,
  AttendanceRecord,
  LeaveType,
  LeaveBalance,
  LeaveRequest,
  Goal,
  TrainingCategory,
  TrainingDocument,
  TrainingAssignment,
};

module.exports = db;
