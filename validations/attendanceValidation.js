const { z } = require("zod");
const { ymdSchema } = require("./dateValidation");
const { pageFields, dateRangeFields, startBeforeEnd } = require("./queryValidation");

const updateAttendanceSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    clockIn: z.string().datetime().nullable().optional(),
    clockOut: z.string().datetime().nullable().optional(),
    status: z.enum(["Present", "Late", "Half-day", "Absent"]).optional(),
  }),
});

const overrideAttendanceSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    // Deliberately excludes 'Absent' — this endpoint corrects AWAY FROM Absent, never to it.
    status: z.enum(["Present", "Late", "Half-day"]),
  }),
});

// One day (default today) or a startDate/endDate range, not both.
const teamAttendanceQuerySchema = z.object({
  query: z
    .object({
      ...pageFields,
      ...dateRangeFields,
      date: ymdSchema.optional(),
      status: z.enum(["Present", "Late", "Half-day", "Absent"]).optional(),
    })
    .refine(...startBeforeEnd)
    .refine((q) => !q.date || (!q.startDate && !q.endDate), {
      message: "Use either date or startDate/endDate",
      path: ["date"],
    }),
});

module.exports = { updateAttendanceSchema, overrideAttendanceSchema, teamAttendanceQuerySchema };
