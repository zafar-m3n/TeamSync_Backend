const cron = require("node-cron");
const logger = require("../utils/logger");
const { TZ } = require("../utils/time");
const { applyDueTerminations } = require("../services/employmentStatusService");

// Deactivates users whose future-dated resignation or termination has arrived.
// Phase 7's nightly job is meant to take this over.
const runEmploymentStatusJob = async () => {
  try {
    const count = await applyDueTerminations();
    logger.cron(`Employment status job: ${count} account(s) deactivated`);
  } catch (err) {
    logger.error(`Employment status job failed: ${err.message}`);
  }
};

const scheduleEmploymentStatusCron = () => {
  const schedule = process.env.NODE_TEAMSYNC_STATUS_CRON_SCHEDULE || "5 0 * * *";
  cron.schedule(schedule, runEmploymentStatusJob, { timezone: TZ });
  logger.info(`Employment status cron scheduled: ${schedule} (${TZ})`);
  // Catch up on anything that came due while the server was down.
  runEmploymentStatusJob();
};

module.exports = { scheduleEmploymentStatusCron, runEmploymentStatusJob };
