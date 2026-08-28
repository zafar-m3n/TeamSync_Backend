const { z } = require("zod");

const createLeaveRequestSchema = z.object({
  body: z
    .object({
      leaveTypeId: z.number().int().positive(),
      startDate: z.string(), // 'YYYY-MM-DD'
      endDate: z.string(),
      isHalfDay: z.boolean().default(false),
    })
    .refine((data) => !data.isHalfDay || data.startDate === data.endDate, {
      message: "A half-day request must have the same start and end date",
      path: ["isHalfDay"],
    }),
});

module.exports = { createLeaveRequestSchema };
