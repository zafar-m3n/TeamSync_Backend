const { z } = require("zod");

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

const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Intern", "Probation"];

const createEmployeeSchema = z.object({
  body: z.object({
    // Account
    email: z.string().email(),
    initialPassword: z.string().min(8),
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
    employeeCode: z.string().min(1).max(30).optional(),
    fullName: z.string().min(1).max(150).optional(),
    dob: z.string().optional(),
    gender: z.string().max(20).optional(),
    phone: z.string().max(30).optional(),
    departmentId: z.number().int().positive().nullable().optional(),
    designation: z.string().max(100).optional(),
    dateOfJoining: z.string().optional(),
    employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
    shiftId: z.number().int().positive().nullable().optional(),
    managerId: z.number().int().positive().nullable().optional(),
    contact: contactSchema.optional(),
    banking: bankingSchema.optional(),
  }),
});

const uploadDocumentSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    docName: z.string().min(1).max(150),
  }),
});

const assignShiftSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({ shiftId: z.number().int().positive().nullable() }),
});

module.exports = {
  createEmployeeSchema,
  updateEmployeeSchema,
  uploadDocumentSchema,
  assignShiftSchema,
};
