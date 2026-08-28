const { z } = require("zod");

const createAssignmentSchema = z.object({
  body: z
    .object({
      documentId: z.number().int().positive(),
      employeeId: z.number().int().positive().optional(),
      departmentId: z.number().int().positive().optional(),
    })
    .refine((data) => data.employeeId != null || data.departmentId != null, {
      message: "An assignment must target an employee, a department, or both",
      path: ["employeeId"],
    }),
});

module.exports = { createAssignmentSchema };
