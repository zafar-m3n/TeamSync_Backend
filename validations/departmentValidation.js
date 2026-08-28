const { z } = require("zod");

const createDepartmentSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    departmentHeadId: z.number().int().positive().optional().nullable(),
  }),
});

const updateDepartmentSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    departmentHeadId: z.number().int().positive().nullable().optional(),
  }),
});

module.exports = { createDepartmentSchema, updateDepartmentSchema };
