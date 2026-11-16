const { z } = require("zod");
const { ymdSchema } = require("./dateValidation");

const withRangeRules = (schema) =>
  schema
    .refine((data) => data.startDate <= data.endDate, {
      message: "End date cannot be before the start date",
      path: ["endDate"],
    })
    .refine((data) => !data.isHalfDay || data.startDate === data.endDate, {
      message: "A half-day request must have the same start and end date",
      path: ["isHalfDay"],
    });

const createLeaveRequestSchema = z.object({
  body: withRangeRules(
    z.object({
      leaveTypeId: z.number().int().positive(),
      startDate: ymdSchema,
      endDate: ymdSchema,
      isHalfDay: z.boolean().default(false),
    }),
  ),
});

const previewLeaveDaysSchema = z.object({
  query: withRangeRules(
    z.object({
      startDate: ymdSchema,
      endDate: ymdSchema,
      isHalfDay: z
        .enum(["true", "false"])
        .default("false")
        .transform((v) => v === "true"),
    }),
  ),
});

module.exports = { createLeaveRequestSchema, previewLeaveDaysSchema };
