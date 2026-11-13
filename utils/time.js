const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = process.env.NODE_TEAMSYNC_APP_TIMEZONE || "UTC";

const nowTz = () => dayjs().tz(TZ);
const todayTz = () => nowTz().format("YYYY-MM-DD");

module.exports = { dayjs, TZ, nowTz, todayTz };
