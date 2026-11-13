"use strict";

const TABLE_OPTIONS = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci";

const TIMESTAMPS = `
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`;

const UP = [
  `CREATE TABLE roles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    is_custom BOOLEAN NOT NULL DEFAULT FALSE,
    description VARCHAR(255) NULL,${TIMESTAMPS}
  ) ${TABLE_OPTIONS}`,

  `CREATE TABLE departments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    department_head_id INT UNSIGNED NULL,${TIMESTAMPS},
    deleted_at DATETIME NULL,
    INDEX idx_departments_head (department_head_id)
  ) ${TABLE_OPTIONS}`,

  `CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT UNSIGNED NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,${TIMESTAMPS},
    deleted_at DATETIME NULL,
    INDEX idx_users_role (role_id),
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
      ON DELETE RESTRICT ON UPDATE CASCADE
  ) ${TABLE_OPTIONS}`,

  `CREATE TABLE shifts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_period_minutes INT UNSIGNED NOT NULL DEFAULT 0,
    working_days JSON NOT NULL,${TIMESTAMPS}
  ) ${TABLE_OPTIONS}`,

  `CREATE TABLE employees (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL UNIQUE,
    employee_code VARCHAR(30) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    dob DATE NULL,
    gender VARCHAR(20) NULL,
    phone VARCHAR(30) NULL,
    department_id INT UNSIGNED NULL,
    designation VARCHAR(100) NULL,
    date_of_joining DATE NULL,
    employment_type ENUM('Full-time','Part-time','Contract','Intern','Probation') NOT NULL DEFAULT 'Full-time',
    shift_id INT UNSIGNED NULL,
    manager_id INT UNSIGNED NULL,${TIMESTAMPS},
    deleted_at DATETIME NULL,
    INDEX idx_employees_department (department_id),
    INDEX idx_employees_shift (shift_id),
    INDEX idx_employees_manager (manager_id),
    INDEX idx_employees_name (full_name),
    CONSTRAINT fk_employees_user FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_employees_department FOREIGN KEY (department_id) REFERENCES departments(id)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_employees_shift FOREIGN KEY (shift_id) REFERENCES shifts(id)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_employees_manager FOREIGN KEY (manager_id) REFERENCES employees(id)
      ON DELETE SET NULL ON UPDATE CASCADE
  ) ${TABLE_OPTIONS}`,

  `ALTER TABLE departments
    ADD CONSTRAINT fk_departments_head FOREIGN KEY (department_head_id) REFERENCES employees(id)
      ON DELETE SET NULL ON UPDATE CASCADE`,

  `CREATE TABLE permissions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_id INT UNSIGNED NOT NULL,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    allowed BOOLEAN NOT NULL DEFAULT FALSE,${TIMESTAMPS},
    UNIQUE KEY uq_permissions_role_module_action (role_id, module, action),
    INDEX idx_permissions_role (role_id),
    CONSTRAINT fk_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id)
      ON DELETE CASCADE ON UPDATE CASCADE
  ) ${TABLE_OPTIONS}`,

  `CREATE TABLE employee_contacts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_id INT UNSIGNED NOT NULL UNIQUE,
    address_line1 VARCHAR(150) NULL,
    address_line2 VARCHAR(150) NULL,
    state VARCHAR(100) NULL,
    country VARCHAR(100) NULL,
    postal_code VARCHAR(20) NULL,
    emergency_contact_name VARCHAR(150) NULL,
    emergency_contact_relationship VARCHAR(50) NULL,
    emergency_contact_phone VARCHAR(30) NULL,${TIMESTAMPS},
    CONSTRAINT fk_employee_contacts_employee FOREIGN KEY (employee_id) REFERENCES employees(id)
      ON DELETE CASCADE ON UPDATE CASCADE
  ) ${TABLE_OPTIONS}`,

  `CREATE TABLE employee_banking (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_id INT UNSIGNED NOT NULL UNIQUE,
    bank_name VARCHAR(100) NULL,
    account_holder_name VARCHAR(150) NULL,
    account_number VARCHAR(50) NULL,
    bank_branch VARCHAR(100) NULL,${TIMESTAMPS},
    CONSTRAINT fk_employee_banking_employee FOREIGN KEY (employee_id) REFERENCES employees(id)
      ON DELETE CASCADE ON UPDATE CASCADE
  ) ${TABLE_OPTIONS}`,

  `CREATE TABLE employee_documents (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_id INT UNSIGNED NOT NULL,
    doc_name VARCHAR(150) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    upload_date DATE NOT NULL,${TIMESTAMPS},
    INDEX idx_employee_documents_employee (employee_id),
    CONSTRAINT fk_employee_documents_employee FOREIGN KEY (employee_id) REFERENCES employees(id)
      ON DELETE CASCADE ON UPDATE CASCADE
  ) ${TABLE_OPTIONS}`,

  `CREATE TABLE attendance_records (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_id INT UNSIGNED NOT NULL,
    date DATE NOT NULL,
    clock_in DATETIME NULL,
    clock_out DATETIME NULL,
    status ENUM('Present','Late','Half-day','Absent') NOT NULL DEFAULT 'Absent',
    is_manual_override BOOLEAN NOT NULL DEFAULT FALSE,
    overridden_by INT UNSIGNED NULL,${TIMESTAMPS},
    UNIQUE KEY uq_attendance_employee_date (employee_id, date),
    INDEX idx_attendance_date (date),
    INDEX idx_attendance_status (status),
    INDEX idx_attendance_overridden_by (overridden_by),
    CONSTRAINT fk_attendance_employee FOREIGN KEY (employee_id) REFERENCES employees(id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_attendance_overridden_by FOREIGN KEY (overridden_by) REFERENCES users(id)
      ON DELETE SET NULL ON UPDATE CASCADE
  ) ${TABLE_OPTIONS}`,

  `CREATE TABLE leave_types (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255) NULL,${TIMESTAMPS}
  ) ${TABLE_OPTIONS}`,

  `CREATE TABLE leave_balances (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_id INT UNSIGNED NOT NULL,
    year SMALLINT UNSIGNED NOT NULL,
    total_days DECIMAL(5,1) NOT NULL DEFAULT 0,
    used_days DECIMAL(5,1) NOT NULL DEFAULT 0,${TIMESTAMPS},
    UNIQUE KEY uq_leave_balances_employee_year (employee_id, year),
    INDEX idx_leave_balances_year (year),
    CONSTRAINT fk_leave_balances_employee FOREIGN KEY (employee_id) REFERENCES employees(id)
      ON DELETE CASCADE ON UPDATE CASCADE
  ) ${TABLE_OPTIONS}`,

  `CREATE TABLE leave_requests (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_id INT UNSIGNED NOT NULL,
    leave_type_id INT UNSIGNED NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_half_day BOOLEAN NOT NULL DEFAULT FALSE,
    status ENUM('Pending','Approved','Rejected','Cancelled') NOT NULL DEFAULT 'Pending',
    approved_by INT UNSIGNED NULL,
    acted_at DATETIME NULL,${TIMESTAMPS},
    deleted_at DATETIME NULL,
    INDEX idx_leave_requests_employee (employee_id),
    INDEX idx_leave_requests_type (leave_type_id),
    INDEX idx_leave_requests_status (status),
    INDEX idx_leave_requests_dates (start_date, end_date),
    INDEX idx_leave_requests_approved_by (approved_by),
    CONSTRAINT fk_leave_requests_employee FOREIGN KEY (employee_id) REFERENCES employees(id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_leave_requests_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id)
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_leave_requests_approved_by FOREIGN KEY (approved_by) REFERENCES users(id)
      ON DELETE SET NULL ON UPDATE CASCADE
  ) ${TABLE_OPTIONS}`,

  `CREATE TABLE goals (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_id INT UNSIGNED NOT NULL,
    manager_id INT UNSIGNED NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NULL,
    numeric_target DECIMAL(12,2) NOT NULL,
    target_date DATE NOT NULL,
    actual_value DECIMAL(12,2) NULL,
    percent_complete DECIMAL(5,2) NULL,${TIMESTAMPS},
    INDEX idx_goals_employee (employee_id),
    INDEX idx_goals_manager (manager_id),
    INDEX idx_goals_target_date (target_date),
    CONSTRAINT fk_goals_employee FOREIGN KEY (employee_id) REFERENCES employees(id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_goals_manager FOREIGN KEY (manager_id) REFERENCES users(id)
      ON DELETE SET NULL ON UPDATE CASCADE
  ) ${TABLE_OPTIONS}`,

  `CREATE TABLE training_categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,${TIMESTAMPS}
  ) ${TABLE_OPTIONS}`,

  `CREATE TABLE training_documents (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT NULL,
    file_path VARCHAR(255) NOT NULL,
    category_id INT UNSIGNED NOT NULL,
    uploaded_by INT UNSIGNED NULL,${TIMESTAMPS},
    deleted_at DATETIME NULL,
    INDEX idx_training_documents_category (category_id),
    INDEX idx_training_documents_uploaded_by (uploaded_by),
    CONSTRAINT fk_training_documents_category FOREIGN KEY (category_id) REFERENCES training_categories(id)
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_training_documents_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id)
      ON DELETE SET NULL ON UPDATE CASCADE
  ) ${TABLE_OPTIONS}`,

  `CREATE TABLE training_assignments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    document_id INT UNSIGNED NOT NULL,
    employee_id INT UNSIGNED NULL,
    department_id INT UNSIGNED NULL,
    assigned_by INT UNSIGNED NULL,${TIMESTAMPS},
    INDEX idx_training_assignments_document (document_id),
    INDEX idx_training_assignments_employee (employee_id),
    INDEX idx_training_assignments_department (department_id),
    INDEX idx_training_assignments_assigned_by (assigned_by),
    CONSTRAINT fk_training_assignments_document FOREIGN KEY (document_id) REFERENCES training_documents(id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_training_assignments_employee FOREIGN KEY (employee_id) REFERENCES employees(id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_training_assignments_department FOREIGN KEY (department_id) REFERENCES departments(id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_training_assignments_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id)
      ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT chk_training_assignments_target CHECK (employee_id IS NOT NULL OR department_id IS NOT NULL)
  ) ${TABLE_OPTIONS}`,
];

const DROP_ORDER = [
  "training_assignments",
  "training_documents",
  "training_categories",
  "goals",
  "leave_requests",
  "leave_balances",
  "leave_types",
  "attendance_records",
  "employee_documents",
  "employee_banking",
  "employee_contacts",
  "permissions",
  "employees",
  "shifts",
  "users",
  "departments",
  "roles",
];

module.exports = {
  async up(queryInterface) {
    for (const sql of UP) {
      await queryInterface.sequelize.query(sql);
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query("ALTER TABLE departments DROP FOREIGN KEY fk_departments_head");
    for (const table of DROP_ORDER) {
      await queryInterface.sequelize.query(`DROP TABLE ${table}`);
    }
  },
};
