const { z } = require("zod");

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

module.exports = { updateAttendanceSchema, overrideAttendanceSchema };
