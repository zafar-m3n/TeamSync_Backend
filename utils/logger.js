require("colors");

const timestamp = () => new Date().toISOString();

const logger = {
  info: (message) => {
    console.log(`[${timestamp()}] INFO: ${message}`.bgCyan);
  },
  success: (message) => {
    console.log(`[${timestamp()}] SUCCESS: ${message}`.bgGreen);
  },
  warn: (message) => {
    console.log(`[${timestamp()}] WARN: ${message}`.bgYellow);
  },
  error: (message) => {
    console.log(`[${timestamp()}] ERROR: ${message}`.bgRed);
  },
  cron: (message) => {
    console.log(`[${timestamp()}] CRON: ${message}`.bgMagenta);
  },
};

module.exports = logger;
