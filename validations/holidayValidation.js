const { z } = require("zod");
const dayjs = require("dayjs");

const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .refine((v) => dayjs(v).format("YYYY-MM-DD") === v, "Not a real date");

const idParams = z.object({ id: z.coerce.number().int().positive() });

const listHolidaysSchema = z.object({
  query: z.object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
  }),
});

const createHolidaySchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(100),
    date: ymd,
  }),
});

const updateHolidaySchema = z.object({
  params: idParams,
  body: z
    .object({
      name: z.string().trim().min(1).max(100).optional(),
      date: ymd.optional(),
    })
    .refine((b) => b.name !== undefined || b.date !== undefined, "Nothing to update"),
});

const deleteHolidaySchema = z.object({ params: idParams });

module.exports = { listHolidaysSchema, createHolidaySchema, updateHolidaySchema, deleteHolidaySchema };
