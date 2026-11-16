const { z } = require("zod");
const { ymdSchema } = require("./dateValidation");

const createLeaveRequestSchema = z.object({
  body: z
    .object({
      leaveTypeId: z.number().int().positive(),
      startDate: ymdSchema,
      endDate: ymdSchema,
      isHalfDay: z.boolean().default(false),
    })
    .refine((data) => data.startDate <= data.endDate, {
      message: "End date cannot be before the start date",
      path: ["endDate"],
    })
    .refine((data) => !data.isHalfDay || data.startDate === data.endDate, {
      message: "A half-day request must have the same start and end date",
      path: ["isHalfDay"],
    }),
});

module.exports = { createLeaveRequestSchema };
