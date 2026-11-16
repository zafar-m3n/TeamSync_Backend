const logger = require("../utils/logger");
const { sendEmail } = require("../utils/email");
const hasPermission = require("../utils/hasPermission");

// Runs `task` once the response has gone out, so email never delays or fails a
// request. Errors are logged, never thrown.
const afterResponse = (res, task) => {
  res.once("finish", () => {
    Promise.resolve()
      .then(task)
      .catch((err) => logger.error(`Notification failed: ${err.message}`));
  });
};

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const appLink = (path) => `${(process.env.NODE_TEAMSYNC_CLIENT_URL || "").replace(/\/$/, "")}${path}`;

// Plain message: a greeting, a few lines, and an optional link. `lines` are plain text.
const compose = ({ greeting, lines, link }) => {
  const all = [greeting, "", ...lines, ...(link ? ["", `${link.label}: ${link.url}`] : [])];
  const html = [
    `<p>${escapeHtml(greeting)}</p>`,
    ...lines.map((l) => `<p>${escapeHtml(l)}</p>`),
    link ? `<p><a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a></p>` : "",
  ].join("\n");
  return { text: all.join("\n"), html };
};

// recipients: [{ email, name }]
const sendToEach = (recipients, subject, buildBody) =>
  Promise.all(recipients.map((r) => sendEmail({ to: r.email, subject, ...buildBody(r) })));

const recipientOf = (user, fullName) => ({ email: user.email, name: fullName ?? null });

const describeLeave = (request, days) => {
  const range =
    request.startDate === request.endDate ? request.startDate : `${request.startDate} to ${request.endDate}`;
  const amount = request.isHalfDay ? "half a day" : `${days} working day${days === 1 ? "" : "s"}`;
  return `${request.leaveType?.name ?? "Leave"}, ${range} (${amount})`;
};

// Active users whose role may approve anyone's leave (leave.approve + leave.view_all).
const leaveApprovers = async (excludeUserId) => {
  const db = require("../models");
  const roles = await db.Role.findAll({ attributes: ["id"] });
  const roleIds = [];
  for (const role of roles) {
    if ((await hasPermission(role.id, "leave", "approve")) && (await hasPermission(role.id, "leave", "view_all"))) {
      roleIds.push(role.id);
    }
  }
  if (!roleIds.length) {
    return [];
  }
  const { Op } = db.Sequelize;
  const users = await db.User.findAll({
    where: { roleId: roleIds, isActive: true, id: { [Op.ne]: excludeUserId } },
    attributes: ["id", "email"],
    include: { association: "employee", attributes: ["fullName"] },
  });
  return users.map((u) => recipientOf(u, u.employee?.fullName));
};

// New leave request: email the employee's manager, or HR/Admin approvers if there is
// no manager with an active account.
const notifyLeaveSubmitted = async (requestId) => {
  const db = require("../models");
  const { leaveDaysFor } = require("./workingDayService");
  const request = await db.LeaveRequest.findByPk(requestId, {
    include: [
      { association: "leaveType", attributes: ["name"] },
      {
        association: "employee",
        attributes: ["id", "fullName", "userId", "managerId"],
        include: {
          association: "manager",
          attributes: ["fullName"],
          include: { association: "user", attributes: ["id", "email", "isActive"] },
        },
      },
    ],
  });
  if (!request) {
    return;
  }

  const { employee } = request;
  const managerUser = employee.manager?.user;
  const toManager = Boolean(managerUser?.isActive);
  const recipients = toManager
    ? [recipientOf(managerUser, employee.manager.fullName)]
    : await leaveApprovers(employee.userId);

  if (!recipients.length) {
    logger.info(`Leave request ${request.id}: no manager or approver to notify, email skipped`);
    return;
  }

  const { total } = await leaveDaysFor(employee.id, request);
  const summary = describeLeave(request, total);
  const subject = `Leave request from ${employee.fullName}`;
  await sendToEach(recipients, subject, (r) =>
    compose({
      greeting: `Hi ${r.name ?? "there"},`,
      lines: [`${employee.fullName} has requested leave: ${summary}.`, "It is waiting for a decision."],
      link: { label: "Review it in TeamSync", url: appLink(toManager ? "/team-leave" : "/leave") },
    }),
  );
};

// Approved or rejected: tell the employee, with dates, type, day count and who decided.
const notifyLeaveDecision = async (requestId) => {
  const db = require("../models");
  const { withLeaveDays } = require("./leaveRequestService");
  const request = await db.LeaveRequest.findByPk(requestId, {
    include: [
      { association: "leaveType", attributes: ["name"] },
      {
        association: "employee",
        attributes: ["id", "fullName"],
        include: { association: "user", attributes: ["email", "isActive"] },
      },
      {
        association: "approvedByUser",
        attributes: ["email"],
        include: { association: "employee", attributes: ["fullName"] },
      },
    ],
  });
  if (!request || !["Approved", "Rejected"].includes(request.status)) {
    return;
  }
  const user = request.employee?.user;
  if (!user?.isActive) {
    logger.info(`Leave request ${request.id}: employee has no active account, decision email skipped`);
    return;
  }

  const [{ days }] = await withLeaveDays([request]);
  const decision = request.status.toLowerCase();
  const decidedBy = request.approvedByUser?.employee?.fullName ?? request.approvedByUser?.email;
  await sendToEach([recipientOf(user, request.employee.fullName)], `Your leave request was ${decision}`, (r) =>
    compose({
      greeting: `Hi ${r.name ?? "there"},`,
      lines: [
        `Your leave request was ${decision}${decidedBy ? ` by ${decidedBy}` : ""}: ${describeLeave(request, days)}.`,
      ],
      link: { label: "See your leave in TeamSync", url: appLink("/my-leave") },
    }),
  );
};

module.exports = {
  afterResponse,
  compose,
  sendToEach,
  recipientOf,
  describeLeave,
  appLink,
  notifyLeaveSubmitted,
  notifyLeaveDecision,
};
