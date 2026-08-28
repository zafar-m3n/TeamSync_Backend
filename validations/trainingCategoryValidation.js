const { z } = require("zod");

const createTrainingCategorySchema = z.object({
  body: z.object({ name: z.string().min(1).max(100) }),
});

const updateTrainingCategorySchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({ name: z.string().min(1).max(100) }),
});

module.exports = { createTrainingCategorySchema, updateTrainingCategorySchema };
