const { z } = require("zod");
const dayjs = require("dayjs");

// A real calendar date as 'YYYY-MM-DD'.
const ymdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Expected YYYY-MM-DD", abort: true })
  .refine((v) => dayjs(v).format("YYYY-MM-DD") === v, "Not a real date");

module.exports = { ymdSchema };
