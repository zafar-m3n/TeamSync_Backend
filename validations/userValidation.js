const { z } = require("zod");

const passwordSchema = z.string().min(8);

const resetPasswordSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({ newPassword: passwordSchema }),
});

const updateStatusSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({ isActive: z.boolean() }),
});

module.exports = { passwordSchema, resetPasswordSchema, updateStatusSchema };
