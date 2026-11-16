const { z } = require("zod");
const { ymdSchema } = require("./dateValidation");

// Shared list-query fields; parsePagination still clamps limit to the configured max.
const pageFields = {
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
};

const dateRangeFields = {
  startDate: ymdSchema.optional(),
  endDate: ymdSchema.optional(),
};

const startBeforeEnd = [
  (q) => !q.startDate || !q.endDate || q.startDate <= q.endDate,
  { message: "End date cannot be before the start date", path: ["endDate"] },
];

module.exports = { pageFields, dateRangeFields, startBeforeEnd };
