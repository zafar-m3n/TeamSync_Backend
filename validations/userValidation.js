const { z } = require("zod");

const resetPasswordSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({ newPassword: z.string().min(8) }),
});

const updateStatusSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({ isActive: z.boolean() }),
});

module.exports = { resetPasswordSchema, updateStatusSchema };
