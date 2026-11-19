# TeamSync

## Overview

TeamSync is a self-hosted internal HR management system for a single organization of roughly 20–100 employees. It is not a commercial or multi-tenant product — it is built around one company's departments, roles, and workflows.

It brings employee records, attendance, leave, monthly performance goals, and internal training material into one system, replacing the spreadsheets, email threads, and manual check-in habits those tasks previously relied on. Every person has one account and one role: HR and Admin staff administer the system, managers act on their own teams, and employees see and act on their own records.

This repository is the **backend API service**. The staff-facing web application is a separate React (Vite) + Tailwind CSS client, deployed and maintained separately, that consumes this API.

## Core Modules

All endpoints are served under `/api/v1` and return a consistent JSON envelope — `{ success: true, data, meta?, message? }` on success (deletes return `data: { id }` with a message), `{ success: false, error: { message, code, details? } }` on failure. List endpoints accept `?page=` and `?limit=` and return `meta: { page, limit, total, totalPages }`.

### Employee Records — `/employees`, `/users`

Creating an employee provisions the login account (email, role, and an initial password set by HR/Admin) and the employee profile together in a single step. No email is sent; HR/Admin pass the starting password on themselves. A profile has five sections: Basic Information (name, employee code, email, phone, date of birth, gender), Employment Details (department, designation, joining date, employment type, employment status, manager), Contact Information, Banking Information, and Documents. Employment type is one of Full-time, Part-time, Contract, or Intern. The shift is assigned separately (`PATCH /employees/:id/shift`). Employee codes are entered manually by HR/Admin.

Viewing is scoped: an employee sees their own full profile, a manager sees a reduced view of each direct report (name, department, designation only), and HR/Admin see any profile in full. Profile documents (PDF, Word, JPEG, PNG) can be uploaded, downloaded and deleted; downloads go through the API (`GET /employees/:id/documents/:documentId/download`) for HR/Admin and for the employee themselves.

Each employee has an employment status: Active, Probation, Suspended, Resigned or Terminated. Resigned and Terminated need a termination date. Suspended, or Resigned/Terminated once that date has arrived, deactivates the login and revokes its sessions; a future date is applied by the nightly job. Lists show current employees by default and can filter to former employees, all, or one status. Status is how people leave; deleting an employee (soft delete) is for records created by mistake and is blocked while they still manage direct reports, head a department, or have pending leave.

Accounts can be toggled active/inactive, and HR/Admin can reset a password on someone's behalf; the user is signed out everywhere and gets an email saying so (the email never contains the password). A user can change their own password, which signs out every other session. Acting on another account (editing, deleting, resetting, deactivating, assigning a role) requires outranking it: Admin > HR > Manager > Employee, with custom roles ranked as Employee; Admin can act on anyone.

### Attendance & Shifts — `/attendance`, `/shifts`

Shifts are a managed list (name, start time, end time, grace period in minutes, working days) created, edited and deleted by HR/Admin, with each employee assigned to at most one. A shift whose end time is not after its start time runs past midnight (e.g. 22:00–06:00); its "shift day" is the day it started. A shift can only be deleted when no current employee (Active, Probation, Suspended, or leaving with a future termination date) is on it; former and soft-deleted employees on it are unassigned in the same transaction.

Employees clock in and out themselves (`POST /attendance/clock-in`, `/attendance/clock-out`; `GET /attendance/me/today` returns the current shift day and record). There is one clock-in per shift day, clock-out only after clock-in, and the clock-in is marked Present or Late depending on whether it falls within the shift start plus grace period. Employees with no assigned shift cannot clock in.

A nightly job settles shifts that have ended: anyone who clocked in but not out gets a clock-out at the shift's end time, and anyone scheduled to work who has no record is marked Absent — except on holidays, on approved full-day leave, before their joining date, and after their termination date. HR/Admin can correct any field on any record; HR/Admin and managers can override an Absent record to Present, Late, or Half-day (managers only for their own reports, and nobody for their own record). Every manual change is flagged with who made it. Employees see their own history, managers see their team's, HR/Admin see everyone's.

### Leave Management — `/leave-types`, `/leave-balances`, `/leave-requests`, `/holidays`

Leave types are a configurable list (name, description) managed by HR/Admin — none are hardcoded. HR/Admin set each employee's balance per leave type per calendar year; there is no carryover between years. Holidays are a managed calendar (one per date) that every role can view.

Leave is counted in working days: the employee's shift working days (Mon–Fri when they have no shift), minus holidays; a half day counts 0.5, and a range across a year boundary is split by year. An employee submits a request (leave type, start and end date, full or half day). It is refused if it overlaps another pending or approved request, covers no working days, or doesn't fit that year's remaining balance after setting aside their other pending requests of the same type. Either the employee's manager or HR/Admin can approve or reject it — one approval is enough, and nobody can act on their own request. Approval re-checks the balance and deducts it. An employee can cancel their own request while it is pending; a manager or HR/Admin can cancel an approved one, which refunds exactly what was deducted. When a half-day request is approved, that day's attendance record is set to Half-day.

Email goes out on three events only: a submitted request (to the employee's manager, or to HR/Admin approvers if they have none), an approval or rejection (to the employee), and an HR password reset (to the user).

### Performance Reviews — `/goals`

A lightweight monthly, numeric goal system driven entirely by managers. A manager creates and edits goals for a direct report (title, description, numeric target, target date); at the end of the cycle the manager records the actual achieved value, and the system calculates percent complete (achieved ÷ target) to two decimal places. There are no written reviews, comments, or rating scales. Employees have view-only access to their own goals, managers see their team's, and HR/Admin see all. A manager can delete the goals of their current direct reports; HR/Admin can delete any goal. A goal records which manager created it, but every access check (view, edit, record actual, delete) uses the employee's *current* manager, so goals follow reporting-line changes.

### Training — `/training-categories`, `/training-documents`, `/training-assignments`

A document repository with assignment tracking — not a learning-management system, and no quizzes or completion tracking. Training categories are a managed list (HR/Admin); a category in use can't be deleted. Any manager can upload a training document (title, description, category, file) and assign it to individual direct reports, to a department they head, or both. An assignment can be removed by the manager who created it or by HR/Admin. A document can be deleted by its uploader or by HR/Admin, which also removes its assignments. Employees see documents assigned to them (directly or through their department), managers see their own uploads and the assignments they made, and HR/Admin see everything, including who uploaded each document and who made each assignment. Anyone who can see a document can download it (`GET /training-documents/:id/download`).

### Roles & Departments — `/roles`, `/departments`

Departments have a name and a designated department head. Each employee belongs to at most one department and reports to at most one manager; the manager is assigned individually and is not automatically the department head. A department cannot be deleted while employees are still assigned to it. Four base roles ship with the system (see below); their names are fixed. Admin can create, rename and delete custom roles, each with its own permission set; a role can't be deleted while users hold it.

### Permissions — `/permissions`

Access control is a configurable role × module × action matrix stored in the database rather than hardcoded role checks. The system seeds a default matrix matching the access rules described above. Admin can view the full matrix and toggle any entry, individually or in bulk, from a settings screen; Admin cannot switch off its own permission-management access. Every protected endpoint checks the requesting user's role against this matrix on each request. Each role's allowed set is cached in memory and dropped whenever that role's permissions change, so a change takes effect on the next request. Default is deny — a permission with no matching row is refused. The frontend gets the signed-in user's permission list from `/auth/login` and `/auth/me` and shows only what it allows.

## Roles & Access

Every account holds exactly one role.

| Role | Default access |
|------|----------------|
| **Admin** | Full system administration: user accounts, roles, departments, and the permission matrix itself, plus every HR function (employee records, shifts, attendance corrections, holidays, leave types, leave quotas, leave approvals). Can grant any role — including Admin — additional permissions through the matrix. By default Admin is *not* in the manager-driven flows (goal setting, training upload/assignment); those can be added via the matrix if needed. |
| **HR** | Employee records and accounts, shifts and shift assignment, attendance corrections, holidays, leave types, leave quotas, and leave approvals. Sees org-wide data across all modules. |
| **Manager** | Acts on their direct reports only — approves/rejects/cancels their leave, sets and reviews their performance goals, uploads and assigns training, overrides their Absent attendance. Sees team-scoped data. |
| **Employee** | Clocks in and out; views their own records; submits and cancels their own pending leave requests; views training and goals assigned to them. |

Admin can also define **custom roles** beyond these four. A custom role starts with no access, and permissions are granted to it entry by entry through the Permissions screen.

## Tech Stack

Backend (this repository):

- **Runtime:** Node.js 20 or newer, CommonJS
- **Framework:** Express 5
- **Database:** MySQL 8 or MariaDB 10.4+ via Sequelize 6 (`mysql2` driver), schema managed with `sequelize-cli` migrations
- **Auth:** JWT (`jsonwebtoken`), password hashing with `bcryptjs`
- **Request validation:** Zod (a schema per route)
- **File uploads:** Multer, stored on local disk
- **Email:** Nodemailer over SMTP
- **Scheduled jobs:** `node-cron`
- **Dates & timezones:** Day.js (`utc` + `timezone` plugins)
- **Supporting:** `morgan` (HTTP request logging), `cors`, `dotenv`, `colors` (console output)

The database schema is defined only by the Sequelize migrations in `migrations/` (see Database below). The service never creates or alters tables itself.

Frontend: a separate React (Vite) + Tailwind CSS v4 application, light mode only, deployed and maintained separately.

## Architecture Notes

- **Single entry point.** `server.js` configures Express, mounts every route under `/api/v1`, verifies the database connection, schedules the attendance job, and starts listening. There is no `app.js`/`server.js` split.
- **Permissions are database-driven and reconfigurable at runtime.** Authorization is never tied to literal role names in code — each protected route resolves `(role, module, action)` against the `permissions` table on every request, defaulting to deny. Admins change this live through `/api/v1/permissions`. The seed step only inserts rows that don't already exist, so re-seeding never overwrites configuration an Admin has changed.
- **Attendance is an explicit clock-in/clock-out.** Clock-in and clock-out are their own endpoints (`attendance.clock` permission), keyed to the employee's shift day so overnight shifts work. The nightly job only fills in what was missed.
- **Nightly job.** `jobs/attendanceCron.js` runs on `NODE_TEAMSYNC_ATTENDANCE_CRON_SCHEDULE` (default `5 0 * * *`) in `NODE_TEAMSYNC_APP_TIMEZONE`. Each run first deactivates accounts whose resignation/termination date has arrived (this also runs once at startup), then settles the last two shift days so overnight shifts are covered: auto clock-out at shift end, and Absent for working days with no record, skipping holidays and approved full-day leave.
- **Employment status and access.** Suspended, or Resigned/Terminated once the termination date has arrived, deactivates the linked user and revokes their sessions; moving back to an active status restores access.
- **JWT auth and revocation.** Tokens carry `{ userId, roleId, tv }` and expire per `NODE_TEAMSYNC_JWT_EXPIRES_IN`. Every request re-loads the user, confirms the account still exists and is active, and compares `tv` with the user's `token_version`. Logging out, a password change or reset, and an employment status that blocks access bump `token_version`, which revokes every older token for that user; a deactivated account is refused on every request regardless.
- **Rate limits.** Login and password change are limited per IP (20 attempts per 15 minutes) and per account (5 failures per 15 minutes), returning 429 `TOO_MANY_ATTEMPTS`. Behind a reverse proxy, set `NODE_TEAMSYNC_TRUST_PROXY` so the real client IP is used.
- **File uploads** are written to the local filesystem: `uploads/employee-documents/` for employee profile documents and `uploads/training-documents/` for training material. The database stores each file's path relative to `uploads/`. Files are never served statically; the download endpoints stream them after the same access checks as the record. Accepted types are PDF, DOC, DOCX, JPEG, and PNG; the size limit is `NODE_TEAMSYNC_UPLOAD_MAX_SIZE_MB` (default 5 MB). The `uploads/` directory must be writable by the service and must persist across deployments — its contents are not in version control.
- **Soft deletes.** Employees, user accounts, departments, training documents, and leave requests are soft-deleted (marked, not physically removed). Everything else is hard-deleted. Soft-deleted rows still count when checking whether a name, email or code is already taken (409).
- **Email is best-effort.** The three notification emails (leave submitted, leave approved/rejected, HR password reset) are sent after the response has gone out, never block or roll back the request, and only log a failure.
- **Health check.** `GET /api/v1/health` returns `{ success: true, data: { status: "ok", timestamp } }` for load-balancer and uptime probes.

### Codebase layout

| Path | Contents |
|------|----------|
| `server.js` | Entry point |
| `routes/` | One router per module; `routes/index.js` mounts them all |
| `controllers/` | Request handlers, one file per module |
| `validations/` | Zod request schemas, one file per module |
| `models/` | Sequelize models (18) and their associations (`models/index.js`) |
| `middleware/` | `auth` (JWT + token version), `permission` (matrix check), `validate` (Zod), `passwordRateLimit`, `errorHandler` |
| `constants/permissionMatrix.js` | The canonical role × module × action list and its defaults |
| `services/` | Business logic shared across controllers: attendance and shift days, working days, leave balances and requests, employment status, sessions, role ranks, notifications |
| `jobs/` | The nightly attendance job |
| `config/` | Database, `sequelize-cli` and Multer configuration |
| `migrations/` | The schema (see Database) |
| `utils/` | Response envelope, error class, logger, email, pagination, time/timezone, permission cache, upload paths and other helpers |
| `seeders/seed.js` | First-run setup (roles, permission matrix, initial Admin) |

## Environment & Deployment

Three things must be in place before the service will run: a filled-in `.env`, an empty database, and one `npm run db:setup` run (migrations, then seed).

### 1. Database

**Migrations are the only source of the schema.** Every table, column, index, foreign key and constraint is created by the files in `migrations/`, starting with the baseline (`20261113000000-baseline-schema.js`). The application does **not** create or alter tables, and there is no separate SQL script. Every schema change — a new table, column, index or constraint — must be a new migration file; never edit the database by hand and never change a migration that has already been applied.

The CLI reads the same `NODE_TEAMSYNC_DB_*` variables as the app (`config/dbSettings.js`), so it always targets the database in `.env`.

| Command | What it does |
|---|---|
| `npm run db:migrate` | Apply all pending migrations |
| `npm run db:migrate:undo` | Revert the most recent migration |
| `npm run db:migrate:status` | List migrations and whether each is applied |
| `npm run seed` | Create base roles, the permission matrix and the first Admin (safe to re-run) |
| `npm run db:setup` | `db:migrate`, then `seed` |

Applied migrations are recorded in the `SequelizeMeta` table.

#### Rebuild the database from scratch

This deletes all data in the database. In PowerShell, from this folder, with the database name, user and host from `.env` (the example uses the default `teamsync` and `root` on `127.0.0.1`; adjust the `mysql.exe` path to your MySQL or MariaDB install — the example is XAMPP):

```powershell
$mysql = "C:\xampp\mysql\bin\mysql.exe"
& $mysql -h 127.0.0.1 -P 3306 -u root -p -e "DROP DATABASE IF EXISTS teamsync; CREATE DATABASE teamsync CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"
npm run db:setup
```

`-p` prompts for the database password; leave it off if the user has none. After `db:setup`, `npm run db:migrate:status` should list every migration as `up`, and the bootstrap Admin from `.env` can log in.

#### Adding a schema change

```powershell
npx sequelize-cli migration:generate --name add-something
```

Fill in `up` and `down` in the new file under `migrations/`, run `npm run db:migrate`, and commit the migration together with the model and code changes that use it.

### 2. Environment variables

Copy `.env.example` to `.env` and fill in real values. Every variable is prefixed `NODE_TEAMSYNC_`. The groups are:

- **Server** — environment name, listen port, the client application's URL (used for CORS and for links in outgoing email), and the Express trust-proxy setting.
- **Database** — host, port, database name, user, password.
- **JWT** — signing secret (use a long random string) and token lifetime.
- **Password hashing** — bcrypt cost factor.
- **SMTP** — host, port, TLS flag, credentials, and the From name/address for outgoing mail. Preset for Zoho SMTP; any SMTP provider works.
- **Uploads** — maximum accepted file size, in MB.
- **Timezone** — the timezone "today", shift days, the late check and leave years are evaluated in.
- **Attendance job** — the cron expression for the nightly job.
- **Pagination** — default and maximum page size for list endpoints.
- **Bootstrap admin** — the email and password for the first Admin account; read only by the seed step.

`.env` is not committed. Keep production secrets in whatever secret store the deployment uses.

### 3. Migrate and seed

Run once, after `.env` is filled in and the empty database exists:

```
npm install
npm run db:setup
```

This applies all migrations, then seeds: it creates the four base roles, seeds the default permission matrix, and creates the first Admin account from `NODE_TEAMSYNC_SEED_ADMIN_EMAIL` / `NODE_TEAMSYNC_SEED_ADMIN_PASSWORD`. It is safe to re-run: it only fills in rows that don't already exist and will not overwrite permission changes made since. Change the bootstrap Admin password after first login (Change password on My Profile). There is no "forgot password" flow; a user who can't sign in asks HR/Admin to reset it.

### 4. Run

```
npm start
```

`npm start` runs the service under Node directly; put a process manager (systemd, pm2, or a container runtime) in front of it to keep it up and restart on failure. `npm run dev` runs it under `nodemon` and is for local development only.

The service holds no state of its own apart from the `uploads/` directory and the database. Run it behind a reverse proxy that terminates TLS. Back up the MySQL database and the `uploads/` directory together — profile and training files are only on disk.

## Business Rules

These behaviours are intentional. Staff who administer or use TeamSync should know them before relying on a behaviour the system doesn't have.

- **A forgotten clock-out is filled in at the shift's end.** If someone clocks in but never clocks out, the nightly job sets their clock-out to the shift's end time, so the record doesn't show when they actually left.
- **Cancelling an approved half-day leave does not undo the attendance change.** If a half-day leave set that day to Half-day and the leave is later cancelled, the attendance record stays Half-day. The system can't tell whether the person actually worked, so it leaves the record for HR to adjust.
- **No carryover.** Balances are per leave type and per calendar year; each new year starts with no balance until HR/Admin sets one.
- **Only HR and Admin can fully edit attendance.** A manager can only override a record that is currently marked Absent (to Present, Late, or Half-day). Managers cannot otherwise change attendance times or statuses.
- **Self-service actions work for every role, not just Employee.** Clocking in, viewing your own records, submitting and cancelling your own pending leave, and viewing training assigned to you are available to HR, Manager, and Admin accounts too — because those people are also employees with their own attendance, leave, and goals.
- **Admin permission-management access is locked on.** The permission that controls the Permissions screen cannot be switched off for the Admin role. This is a safety lock so no one can lock everyone out of permission configuration.
- **Account and record safety guards.** Nobody can delete or deactivate their own account; an employee who manages people, heads a department or has pending leave can't be deleted; departments, roles, shifts, leave types and training categories can't be deleted while still in use (reassign first).
- **Initial passwords are set and communicated by HR/Admin.** When an employee is created, HR/Admin type that person's starting password and pass it on themselves; no email is sent.
- **Performance goals follow the current reporting line.** A goal displays the manager who created it, but who can view, edit, record progress on or delete it always tracks the employee's *current* manager. If someone's manager changes, their existing goals move to the new manager, and the previous manager loses access.
- **Department-wide training assignment requires being the department head.** A manager can assign training to a whole department only if they are that department's designated head; otherwise they assign to individual direct reports. Only the Manager role has the assign permission by default, so HR and Admin don't assign training.
- **The login dashboard has three fixed layouts** — Employee, Manager, and HR/Admin. A user on a custom role sees the Employee dashboard layout, regardless of what that custom role's permissions allow elsewhere; without `attendance.clock` it shows today's attendance instead of the clock panel.
- **The HR/Admin "recent activity" feed is a summary, not an audit log.** It is assembled from recent records (new employees, new leave requests, new training assignments) for a quick at-a-glance view. It does not capture every kind of action and is not a tamper-proof history.

## Out of Scope

The following are explicitly out of scope for this version per the product scope document: payroll processing; recruitment/hiring; training completion tracking, quizzes, or assessments; multi-role accounts; multiple managers per employee; leave-request file attachments; written self-review comments in Performance Reviews; "forgot password" or forced-reset flows; an audit log; and employee self-registration.
