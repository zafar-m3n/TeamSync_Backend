const { z } = require("zod");
const { passwordSchema } = require("./userValidation");
const { ymdSchema } = require("./dateValidation");
const { EMPLOYMENT_STATUSES } = require("../services/employmentStatusService");

const contactSchema = z.object({
  addressLine1: z.string().max(150).optional(),
  addressLine2: z.string().max(150).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  emergencyContactName: z.string().max(150).optional(),
  emergencyContactRelationship: z.string().max(50).optional(),
  emergencyContactPhone: z.string().max(30).optional(),
});

const bankingSchema = z.object({
  bankName: z.string().max(100).optional(),
  accountHolderName: z.string().max(150).optional(),
  accountNumber: z.string().max(50).optional(),
  bankBranch: z.string().max(100).optional(),
});

// On update, null clears an optional value.
const withNullableFields = (schema) =>
  z.object(Object.fromEntries(Object.entries(schema.shape).map(([key, field]) => [key, field.nullable()])));

const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Intern"];

const createEmployeeSchema = z.object({
  body: z.object({
    // Account
    email: z.string().email(),
    initialPassword: passwordSchema,
    roleId: z.number().int().positive(),
    // Basic Information
    employeeCode: z.string().min(1).max(30),
    fullName: z.string().min(1).max(150),
    dob: z.string().optional(), // 'YYYY-MM-DD'
    gender: z.string().max(20).optional(),
    phone: z.string().max(30).optional(),
    // Employment Details
    departmentId: z.number().int().positive().optional().nullable(),
    designation: z.string().max(100).optional(),
    dateOfJoining: z.string().optional(), // 'YYYY-MM-DD'
    employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
    employmentStatus: z.enum(EMPLOYMENT_STATUSES).optional(),
    terminationDate: ymdSchema.nullable().optional(),
    shiftId: z.number().int().positive().optional().nullable(),
    managerId: z.number().int().positive().optional().nullable(),
    // Contact Information (optional at creation)
    contact: contactSchema.optional(),
    // Banking Information (optional at creation)
    banking: bankingSchema.optional(),
  }),
});

const updateEmployeeSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    email: z.string().email().optional(),
    roleId: z.number().int().positive().optional(),
    employeeCode: z.string().min(1).max(30).optional(),
    fullName: z.string().min(1).max(150).optional(),
    dob: z.string().nullable().optional(),
    gender: z.string().max(20).nullable().optional(),
    phone: z.string().max(30).nullable().optional(),
    departmentId: z.number().int().positive().nullable().optional(),
    designation: z.string().max(100).nullable().optional(),
    dateOfJoining: z.string().nullable().optional(),
    employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
    employmentStatus: z.enum(EMPLOYMENT_STATUSES).optional(),
    terminationDate: ymdSchema.nullable().optional(),
    shiftId: z.number().int().positive().nullable().optional(),
    managerId: z.number().int().positive().nullable().optional(),
    contact: withNullableFields(contactSchema).optional(),
    banking: withNullableFields(bankingSchema).optional(),
  }),
});

const deleteEmployeeSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});

const uploadDocumentSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    docName: z.string().min(1).max(150),
  }),
});

const documentParamsSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
    documentId: z.coerce.number().int().positive(),
  }),
});

const assignShiftSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({ shiftId: z.number().int().positive().nullable() }),
});

module.exports = {
  createEmployeeSchema,
  updateEmployeeSchema,
  deleteEmployeeSchema,
  uploadDocumentSchema,
  documentParamsSchema,
  assignShiftSchema,
};
