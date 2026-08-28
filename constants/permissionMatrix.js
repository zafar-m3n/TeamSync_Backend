const PERMISSION_MATRIX = [
  // Employee Records (Phase 6)
  { module: "employees", action: "create", roles: ["HR", "Admin"] },
  { module: "employees", action: "edit", roles: ["HR", "Admin"] },
  { module: "employees", action: "view_own", roles: ["Admin", "HR", "Manager", "Employee"] },
  { module: "employees", action: "view_team", roles: ["Manager"] },
  { module: "employees", action: "view_all", roles: ["HR", "Admin"] },

  // Attendance & Shifts (Phase 7)
  { module: "shifts", action: "manage", roles: ["HR", "Admin"] },
  { module: "shifts", action: "assign", roles: ["HR", "Admin"] },
  { module: "attendance", action: "edit", roles: ["HR", "Admin"] },
  { module: "attendance", action: "override", roles: ["HR", "Admin", "Manager"] },
  { module: "attendance", action: "view_own", roles: ["Admin", "HR", "Manager", "Employee"] },
  { module: "attendance", action: "view_team", roles: ["Manager"] },
  { module: "attendance", action: "view_all", roles: ["HR", "Admin"] },

  // Leave Management (Phase 8)
  { module: "leave_types", action: "manage", roles: ["HR", "Admin"] },
  { module: "leave_types", action: "view", roles: ["Admin", "HR", "Manager", "Employee"] },
  { module: "leave", action: "set_quota", roles: ["HR", "Admin"] },
  { module: "leave", action: "submit", roles: ["Admin", "HR", "Manager", "Employee"] },
  { module: "leave", action: "approve", roles: ["Manager", "HR"] },
  { module: "leave", action: "cancel_pending", roles: ["Admin", "HR", "Manager", "Employee"] },
  { module: "leave", action: "cancel_approved", roles: ["Manager", "HR"] },
  { module: "leave", action: "view_own", roles: ["Admin", "HR", "Manager", "Employee"] },
  { module: "leave", action: "view_team", roles: ["Manager"] },
  { module: "leave", action: "view_all", roles: ["HR", "Admin"] },

  // Performance Reviews (Phase 9)
  { module: "goals", action: "create", roles: ["Manager"] },
  { module: "goals", action: "edit", roles: ["Manager"] },
  { module: "goals", action: "record_actual", roles: ["Manager"] },
  { module: "goals", action: "view_own", roles: ["Admin", "HR", "Manager", "Employee"] },
  { module: "goals", action: "view_team", roles: ["Manager"] },
  { module: "goals", action: "view_all", roles: ["HR", "Admin"] },

  // Training (Phase 10)
  { module: "training_categories", action: "manage", roles: ["HR", "Admin"] },
  { module: "training_categories", action: "view", roles: ["Admin", "HR", "Manager", "Employee"] },
  { module: "training", action: "upload", roles: ["Manager"] },
  { module: "training", action: "assign", roles: ["Manager"] },
  { module: "training", action: "remove_assignment", roles: ["Manager", "HR", "Admin"] },
  { module: "training", action: "view_assigned", roles: ["Admin", "HR", "Manager", "Employee"] },
  { module: "training", action: "view_own_uploads", roles: ["Manager"] },
  { module: "training", action: "view_all", roles: ["HR", "Admin"] },

  // Roles & Departments (Phases 3–4, already built and depending on these)
  { module: "roles", action: "view", roles: ["HR", "Admin"] },
  { module: "roles", action: "manage", roles: ["Admin"] },
  { module: "departments", action: "create", roles: ["HR", "Admin"] },
  { module: "departments", action: "view", roles: ["Admin", "HR", "Manager", "Employee"] },
  { module: "departments", action: "edit", roles: ["HR", "Admin"] },
  { module: "departments", action: "delete", roles: ["HR", "Admin"] },
  { module: "users", action: "view", roles: ["HR", "Admin"] },
  { module: "users", action: "reset_password", roles: ["HR", "Admin"] },
  { module: "users", action: "update_status", roles: ["HR", "Admin"] },

  // Permissions (this phase)
  { module: "permissions", action: "view", roles: ["Admin"] },
  { module: "permissions", action: "manage", roles: ["Admin"] },
];

module.exports = { PERMISSION_MATRIX };
