const { z } = require("zod");

const createRoleSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(50),
    description: z.string().max(255).optional(),
  }),
});

module.exports = { createRoleSchema };
