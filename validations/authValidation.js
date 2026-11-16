const { z } = require("zod");
const { passwordSchema } = require("./userValidation");

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
  }),
});

module.exports = { loginSchema, changePasswordSchema };
