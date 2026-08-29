# TeamSync

## Overview

TeamSync is a self-hosted internal HR management system for a single organization of roughly 20–100 employees. It is not a commercial or multi-tenant product — it is built around one company's departments, roles, and workflows.

It brings employee records, attendance, leave, monthly performance goals, and internal training material into one system, replacing the spreadsheets, email threads, and manual check-in habits those tasks previously relied on. Every person has one account and one role: HR and Admin staff administer the system, managers act on their own teams, and employees see and act on their own records.

This repository is the **backend API service**. The staff-facing web application is a separate React (Vite) + Tailwind CSS client, deployed and maintained separately, that consumes this API.

## Core Modules

All endpoints are served under `/api/v1` and return a consistent JSON envelope — `{ success: true, data, meta? }` on success, `{ success: false, error: { message, code, details? } }` on failure. List endpoints accept `?page=` and `?limit=` and return `meta: { page, limit, total, totalPages }`.

### Employee Records — `/employees`, `/users`

Creating an employee provisions the login account (email, role, and an initial password set by HR/Admin) and the employee profile together in a single step, and sends the new employee a welcome email confirming the account and where to log in (the email does not contain the password). A profile has five sections: Basic Information (name, employee code, email, phone, date of birth, gender), Employment Details (department, designation, joining date, employment type, shift, manager), Contact Information, Banking Information, and Documents (uploaded files, no verification workflow). Viewing is scoped: an employee sees their own full profile, a manager sees a reduced view of each direct report (name, department, designation only — not banking or documents), and HR/Admin see any profile in full. Employee codes are entered manually by HR/Admin; employment type is one of Full-time, Part-time, Contract, Intern, or Probation. Accounts can be toggled active/inactive, and HR/Admin can reset a password on an employee's behalf.

### Attendance & Shifts — `/attendance`, `/shifts`

Shifts are a managed list (name, start time, end time, grace period in minutes, working days) created by HR/Admin, with each employee assigned to one. Clock-in is automatic: an employee's first successful login of the day creates that day's attendance record, marked Present or Late depending on whether the login falls within the shift start time plus grace period. Employees with no assigned shift are not tracked. A nightly background job closes out the previous day — it marks Absent anyone who was scheduled to work but never logged in, and fills a clock-out time at the shift's end for anyone who logged in but has no clock-out. HR/Admin can correct any field on any record; HR/Admin and managers can additionally override an Absent record to Present, Late, or Half-day. Every manual change is flagged with who made it. Employees see their own history, managers see their team's, HR/Admin see everyone's.

### Leave Management — `/leave-types`, `/leave-balances`, `/leave-requests`

Leave types are a configurable list (name, description) managed by HR/Admin — none are hardcoded. Each employee has a single shared leave-day pool per calendar year (not a separate balance per type), set by HR/Admin, with no carryover between years. An employee submits a request (leave type, start and end date, full or half day), which is created as Pending regardless of their remaining balance. Either the employee's manager or HR can approve or reject it — both are not required. The balance is checked and deducted only at approval; a request that would exceed the remaining balance is rejected at that point. A half day deducts 0.5; a date range deducts its inclusive day count. An employee can cancel their own request while it is still pending; only a manager or HR can cancel an already-approved request, which refunds the deducted days. When a half-day request is approved, that day's attendance record is automatically set to Half-day.

### Performance Reviews — `/goals`

A lightweight monthly, numeric goal system driven entirely by managers. A manager creates a goal for a direct report (title, description, numeric target, target date); at the end of the cycle the manager records the actual achieved value, and the system calculates percent complete (achieved ÷ target) to two decimal places. There are no written reviews, comments, or rating scales. Employees have view-only access to their own goals, managers see their team's, and HR/Admin see all. A goal records which manager created it, but every access check uses the employee's *current* manager, so goals follow reporting-line changes.

### Training — `/training-categories`, `/training-documents`, `/training-assignments`

A document repository with assignment tracking — not a learning-management system, and no quizzes or completion tracking. Training categories are a managed list (HR/Admin). Any manager can upload a training document (title, description, category, file) and assign it to individual direct reports, to a department they head, or both. An assignment can be removed by the manager who created it or by HR/Admin. Employees see documents assigned to them (directly or through their department), managers see their own uploads and the assignments they made, and HR/Admin see everything. There is no endpoint to delete a training document itself — only to remove its assignments.

### Roles & Departments — `/roles`, `/departments`

Departments have a name and a designated department head. Each employee belongs to at most one department and reports to exactly one manager; the manager is assigned individually and is not automatically the department head. A department cannot be deleted while employees are still assigned to it. Four base roles ship with the system (see below); Admin can create additional custom roles, each with its own permission set.

### Permissions — `/permissions`

Access control is a configurable role × module × action matrix stored in the database rather than hardcoded role checks. The system seeds a default matrix matching the access rules described above. Admin can view the full matrix and toggle any entry, individually or in bulk, from a settings screen; Admin cannot switch off its own permission-management access. Every protected endpoint re-checks the requesting user's role against this matrix on each request, so a change takes effect on that user's next request. Default is deny — a permission with no matching row is refused.

## Roles & Access

Every account holds exactly one role.

| Role | Default access |
|------|----------------|
| **Admin** | Full system administration: user accounts, roles, departments, and the permission matrix itself, plus every HR record-and-configuration function (employee records, shifts, attendance corrections, leave types, leave quotas). Can grant any role — including Admin — additional permissions through the matrix. By default Admin is *not* in the leave-approval or manager-driven flows (goal setting, training upload/assignment); those can be added via the matrix if needed. |
| **HR** | Employee records and accounts, shifts and shift assignment, attendance corrections, leave types, leave quotas, and leave approvals. Sees org-wide data across all modules. |
| **Manager** | Acts on their direct reports only — approves/rejects/cancels their leave, sets and reviews their performance goals, uploads and assigns training, overrides their Absent attendance. Sees team-scoped data. |
| **Employee** | Views their own records; submits and cancels their own pending leave requests; views training and goals assigned to them. |

Admin can also define **custom roles** beyond these four. A custom role starts with no access, and permissions are granted to it entry by entry through the Permissions screen.

## Tech Stack

Backend (this repository):

- **Runtime:** Node.js 18 or newer, CommonJS
- **Framework:** Express 5
- **Database:** MySQL 8 via Sequelize 6 (`mysql2` driver)
- **Auth:** JWT (`jsonwebtoken`), password hashing with `bcryptjs`
- **Request validation:** Zod (a schema per route)
- **File uploads:** Multer, stored on local disk
- **Email:** Nodemailer over SMTP
- **Scheduled jobs:** `node-cron`
- **Dates & timezones:** Day.js (`utc` + `timezone` plugins)
- **Supporting:** `morgan` (HTTP request logging), `cors`, `dotenv`, `colors` (console output)

There is no ORM-managed schema migration — the database schema is applied from a SQL script before the service starts (see Environment & Deployment).

Frontend: a separate React (Vite) + Tailwind CSS v4 application (teal accent, light mode only), deployed and maintained separately.

## Architecture Notes

- **Single entry point.** `server.js` configures Express, mounts every route under `/api/v1`, verifies the database connection, schedules the attendance job, and starts listening. There is no `app.js`/`server.js` split.
- **Permissions are database-driven and reconfigurable at runtime.** Authorization is never tied to literal role names in code — each protected route resolves `(role, module, action)` against the `permissions` table on every request, defaulting to deny. Admins change this live through `/api/v1/permissions`. The seed step only inserts rows that don't already exist, so re-seeding never overwrites configuration an Admin has changed.
- **Attendance comes from login activity, not a clock-in action.** There is no manual clock-in or clock-out. The first login of the day writes the attendance record; end-of-day handling (Absent marking and clock-out fill-in) is done by the nightly job.
- **Daily attendance job.** `jobs/attendanceCron.js` runs on the schedule in `NODE_TEAMSYNC_ATTENDANCE_CRON_SCHEDULE` (default: midnight daily). Each run processes the *previous* day: for every employee with an assigned shift whose working days include that day, it creates an `Absent` record where none exists, and sets a clock-out at the shift's end time for anyone who clocked in but never clocked out. All shift-time math uses `NODE_TEAMSYNC_APP_TIMEZONE`.
- **JWT auth.** Tokens carry `{ userId, roleId, roleName }` and expire per `NODE_TEAMSYNC_JWT_EXPIRES_IN`. The `roleName` in the token is informational only — every request re-loads the user from the database, confirms the account still exists and is active, and re-reads the current `roleId`, so a deactivation or role change takes effect on the next request.
- **File uploads** are written to the local filesystem: `uploads/employee-documents/` for employee profile documents and `uploads/training-documents/` for training material. Accepted types are PDF, DOC, DOCX, JPEG, and PNG; the size limit is `NODE_TEAMSYNC_UPLOAD_MAX_SIZE_MB` (default 5 MB). The `uploads/` directory must be writable by the service and must persist across deployments — its contents are not in version control.
- **Soft deletes.** Employees, user accounts, departments, training documents, and leave requests are soft-deleted (marked, not physically removed). Everything else is hard-deleted.
- **Email is best-effort.** The welcome email on employee creation (and any future notifications) is sent after the database work has committed and never blocks or rolls back an operation if delivery fails.
- **Health check.** `GET /api/v1/health` returns `{ success: true, data: { status: "ok", timestamp } }` for load-balancer and uptime probes.

### Codebase layout

| Path | Contents |
|------|----------|
| `server.js` | Entry point |
| `routes/` | One router per module; `routes/index.js` mounts them all |
| `controllers/` | Request handlers, one file per module |
| `validations/` | Zod request schemas, one file per module |
| `models/` | Sequelize models (17) and their associations (`models/index.js`) |
| `middleware/` | `auth` (JWT), `permission` (matrix check), `validate` (Zod), `errorHandler` |
| `constants/permissionMatrix.js` | The canonical role × module × action list and its defaults |
| `services/` | Cross-module helpers (e.g. the half-day attendance hook) |
| `jobs/` | The scheduled attendance job |
| `config/` | Database and Multer configuration |
| `utils/` | Response envelope, error class, logger, email, pagination helpers |
| `seeders/seed.js` | First-run setup (roles, permission matrix, initial Admin) |

## Environment & Deployment

Three things must be in place before the service will run: a MySQL database with the schema applied, a filled-in `.env`, and one seed run.

### 1. Database

Create a MySQL 8 database and apply the schema script (`SQL Script.txt`, provided with the project — it creates the `teamsync` database and all 17 tables, and uses JSON columns and CHECK constraints). The application does **not** create or alter tables — the schema must exist before first start. Point the `NODE_TEAMSYNC_DB_*` variables at this database.

### 2. Environment variables

Copy `.env.example` to `.env` and fill in real values. Every variable is prefixed `NODE_TEAMSYNC_`. The groups are:

- **Server** — environment name, listen port, and the client application's URL (used for CORS and for links in outgoing email).
- **Database** — host, port, database name, user, password.
- **JWT** — signing secret (use a long random string) and token lifetime.
- **Password hashing** — bcrypt cost factor.
- **SMTP** — host, port, TLS flag, credentials, and the From name/address for outgoing mail. Preset for Zoho SMTP; any SMTP provider works.
- **Uploads** — maximum accepted file size, in MB.
- **Timezone** — the timezone all shift-time and leave-date logic is evaluated in.
- **Attendance job** — the cron expression for the nightly close-out job.
- **Pagination** — default and maximum page size for list endpoints.
- **Bootstrap admin** — the email and password for the first Admin account; read only by the seed step.

`.env` is not committed. Keep production secrets in whatever secret store the deployment uses.

### 3. Seed

Run once, after the database and `.env` are ready:

```
npm install
npm run seed
```

This creates the four base roles, seeds the default permission matrix, and creates the first Admin account from `NODE_TEAMSYNC_SEED_ADMIN_EMAIL` / `NODE_TEAMSYNC_SEED_ADMIN_PASSWORD`. It is safe to re-run: it only fills in rows that don't already exist and will not overwrite permission changes made since. Change the bootstrap Admin password after first login — there is no self-service password reset, so an existing Admin or HR user does it via the password-reset endpoint.

### 4. Run

```
npm start
```

`npm start` runs the service under Node directly; put a process manager (systemd, pm2, or a container runtime) in front of it to keep it up and restart on failure. `npm run dev` runs it under `nodemon` and is for local development only.

The service holds no state of its own apart from the `uploads/` directory and the database. Run it behind a reverse proxy that terminates TLS. Back up the MySQL database and the `uploads/` directory together — profile and training files are only on disk.

## Known Limitations

These are deliberate boundaries of the current version, not defects. Staff who administer or use TeamSync should read this before relying on a behavior the system doesn't have.

- **Clock-out is automatic, not an action.** There is no "clock out" button anywhere. Clock-out time is filled in at the assigned shift's end time by the nightly job. Someone who leaves early or stays late still shows their shift's end time as clock-out.
- **A full day of approved leave still shows as Absent.** Attendance status has no "On Leave" value, so only *half-day* leave updates the attendance record. An employee on approved full-day leave who doesn't log in is marked Absent by the nightly job; HR/Admin must correct that record manually if it matters.
- **Cancelling an approved half-day leave does not undo the attendance change.** If a half-day leave set that day to Half-day and the leave is later cancelled, the attendance record stays Half-day. The system can't tell whether the person actually worked, so it leaves the record for HR to adjust.
- **Leave balance is only checked at approval, not at submission.** An employee can submit a request that exceeds their remaining balance; it is simply held as Pending. The shortfall is caught when a manager or HR tries to approve it.
- **One shared leave pool per person, reset yearly.** There are no per-type balances (no separate "sick" and "annual" counts) and no carryover — each new calendar year starts with no balance until HR/Admin sets one.
- **Only HR and Admin can fully edit attendance.** A manager can only override a record that is currently marked Absent (to Present, Late, or Half-day). Managers cannot otherwise change attendance times or statuses.
- **Self-service actions work for every role, not just Employee.** Viewing your own records, submitting and cancelling your own pending leave, and viewing training assigned to you are available to HR, Manager, and Admin accounts too — because those people are also employees with their own attendance, leave, and goals.
- **Admin permission-management access is locked on.** The permission that controls the Permissions screen cannot be switched off for the Admin role. This is a safety lock so no one can lock everyone out of permission configuration.
- **Two account-level safety guards.** An Admin cannot deactivate their own account, and a department cannot be deleted while employees are still assigned to it (reassign them first).
- **Initial passwords are set and communicated by HR/Admin.** When an employee is created, HR/Admin type that person's starting password and pass it on themselves. The welcome email confirms the account exists and where to sign in but never contains the password.
- **Performance goals follow the current reporting line.** A goal displays the manager who created it, but who can view or edit it always tracks the employee's *current* manager. If someone's manager changes, their existing goals move to the new manager.
- **Training documents cannot be deleted through the app.** Once uploaded, a training document stays; only its assignments can be removed. Removing a document entirely requires a direct database and file change.
- **Department-wide training assignment requires being the department head.** A manager can assign training to a whole department only if they are that department's designated head; otherwise they assign to individual direct reports.
- **The login dashboard has three fixed layouts** — Employee, Manager, and HR/Admin. A user on a custom role sees the Employee dashboard layout, regardless of what that custom role's permissions allow elsewhere.
- **The HR/Admin "recent activity" feed is a summary, not an audit log.** It is assembled from recent records (new employees, new leave requests, new training assignments) for a quick at-a-glance view. It does not capture every kind of action and is not a tamper-proof history.

Beyond the above, the following are explicitly out of scope for this version per the product scope document: payroll processing; recruitment/hiring; training completion tracking, quizzes, or assessments; multi-role accounts; multiple managers per employee; leave-request file attachments; written self-review comments in Performance Reviews; self-service or forced-reset passwords; employee self-registration; and dark mode.
