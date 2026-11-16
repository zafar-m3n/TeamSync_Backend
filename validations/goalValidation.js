const { z } = require("zod");

const createGoalSchema = z.object({
  body: z.object({
    employeeId: z.number().int().positive(),
    title: z.string().min(1).max(150),
    description: z.string().optional(),
    numericTarget: z.number().positive(),
    targetDate: z.string(), // 'YYYY-MM-DD'
  }),
});

const goalIdParams = z.object({ id: z.coerce.number().int().positive() });

const goalIdSchema = z.object({ params: goalIdParams });

const updateGoalSchema = z.object({
  params: goalIdParams,
  body: z.object({
    title: z.string().min(1).max(150).optional(),
    description: z.string().optional(),
    numericTarget: z.number().positive().optional(),
    targetDate: z.string().optional(),
  }),
});

const recordActualSchema = z.object({
  params: goalIdParams,
  body: z.object({
    actualValue: z.number().min(0),
  }),
});

module.exports = { createGoalSchema, updateGoalSchema, recordActualSchema, goalIdSchema };
