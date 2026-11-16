const { z } = require("zod");

const roleName = z.string().min(1).max(50);
const roleDescription = z.string().max(255);

const createRoleSchema = z.object({
  body: z.object({
    name: roleName,
    description: roleDescription.optional(),
  }),
});

const roleIdParams = z.object({ id: z.coerce.number().int().positive() });

const roleIdSchema = z.object({ params: roleIdParams });

const updateRoleSchema = z.object({
  params: roleIdParams,
  body: z
    .object({
      name: roleName.optional(),
      description: roleDescription.nullable().optional(),
    })
    .refine((b) => b.name !== undefined || b.description !== undefined, {
      message: "Provide a name or description to update",
    }),
});

module.exports = { createRoleSchema, updateRoleSchema, roleIdSchema };
