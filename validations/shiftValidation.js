const { z } = require("zod");

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

const createShiftSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    startTime: z.string().regex(TIME_REGEX, "Expected HH:MM or HH:MM:SS"),
    endTime: z.string().regex(TIME_REGEX, "Expected HH:MM or HH:MM:SS"),
    gracePeriodMinutes: z.number().int().min(0).default(0),
    workingDays: z.array(z.enum(WEEKDAYS)).min(1),
  }),
});

const updateShiftSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    startTime: z.string().regex(TIME_REGEX).optional(),
    endTime: z.string().regex(TIME_REGEX).optional(),
    gracePeriodMinutes: z.number().int().min(0).optional(),
    workingDays: z.array(z.enum(WEEKDAYS)).min(1).optional(),
  }),
});

module.exports = { createShiftSchema, updateShiftSchema, WEEKDAYS };
