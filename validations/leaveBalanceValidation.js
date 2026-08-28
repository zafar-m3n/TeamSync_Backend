const { z } = require("zod");

const setLeaveBalanceSchema = z.object({
  params: z.object({
    employeeId: z.coerce.number().int().positive(),
    year: z.coerce.number().int().min(2000).max(2100),
  }),
  body: z.object({
    totalDays: z.number().min(0),
  }),
});

module.exports = { setLeaveBalanceSchema };
