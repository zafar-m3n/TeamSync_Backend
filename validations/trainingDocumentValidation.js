const { z } = require("zod");

const uploadTrainingDocumentSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(150),
    description: z.string().optional(),
    categoryId: z.coerce.number().int().positive(),
  }),
});

module.exports = { uploadTrainingDocumentSchema };
