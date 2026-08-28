const nodemailer = require("nodemailer");
const logger = require("./logger");

const transporter = nodemailer.createTransport({
  host: process.env.NODE_TEAMSYNC_SMTP_HOST,
  port: parseInt(process.env.NODE_TEAMSYNC_SMTP_PORT, 10),
  secure: process.env.NODE_TEAMSYNC_SMTP_SECURE === "true",
  auth: {
    user: process.env.NODE_TEAMSYNC_SMTP_USER,
    pass: process.env.NODE_TEAMSYNC_SMTP_PASSWORD,
  },
});

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    await transporter.sendMail({
      from: `"${process.env.NODE_TEAMSYNC_SMTP_FROM_NAME}" <${process.env.NODE_TEAMSYNC_SMTP_FROM_EMAIL}>`,
      to,
      subject,
      html,
      text,
    });
    logger.success(`Email sent to ${to}: ${subject}`);
  } catch (err) {
    logger.error(`Failed to send email to ${to}: ${err.message}`);
    // Deliberately does not rethrow — a failed notification email must
    // never roll back or block a business action that already succeeded
    // (e.g. a leave request that was already approved in the DB).
    // Callers that need to know about failure can inspect the resolved
    // value in future, but for v1, failures are logged only.
  }
};

module.exports = { sendEmail };
