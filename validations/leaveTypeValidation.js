const { z } = require("zod");

const createLeaveTypeSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(255).optional(),
  }),
});

const updateLeaveTypeSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(255).optional(),
  }),
});

module.exports = { createLeaveTypeSchema, updateLeaveTypeSchema };
