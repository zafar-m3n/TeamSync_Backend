const { z } = require("zod");

const updatePermissionSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({ allowed: z.boolean() }),
});

const bulkUpdatePermissionsSchema = z.object({
  body: z.object({
    updates: z
      .array(
        z.object({
          id: z.number().int().positive(),
          allowed: z.boolean(),
        }),
      )
      .min(1),
  }),
});

module.exports = { updatePermissionSchema, bulkUpdatePermissionsSchema };
