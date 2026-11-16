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

// Resolves to nodemailer's send info, or null if sending failed (logged, never thrown).
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.NODE_TEAMSYNC_SMTP_FROM_NAME}" <${process.env.NODE_TEAMSYNC_SMTP_FROM_EMAIL}>`,
      to,
      subject,
      html,
      text,
    });
    logger.success(`Email sent to ${to}: ${subject}`);
    return info;
  } catch (err) {
    // Never rethrow: a failed notification must not undo or block the action
    // that triggered it.
    logger.error(`Failed to send email to ${to}: ${err.message}`);
    return null;
  }
};

module.exports = { sendEmail };
