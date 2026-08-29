import { z } from "zod";

export const attendanceSchema = z.object({
  employeeId: z.string().min(1),
  attendanceDate: z.string().min(1),
  status: z.enum(["PRESENT", "ABSENT", "WEEKLY_OFF", "HOLIDAY"]),
  remarks: z.string().optional().or(z.literal("")),
});

export const advanceSchema = z.object({
  employeeId: z.string().min(1),
  advanceDate: z.string().min(1),
  amount: z.coerce.number().min(0, "Advance cannot be negative"),
  reference: z.string().optional().or(z.literal("")),
  remarks: z.string().optional().or(z.literal("")),
  payrollPeriodId: z.string().optional().or(z.literal("")),
});

export const holidaySchema = z.object({
  date: z.string().min(1),
  name: z.string().trim().min(1, "Holiday name is required"),
  type: z.enum(["PUBLIC_HOLIDAY", "COMPANY_HOLIDAY", "OPTIONAL_HOLIDAY"]).default("PUBLIC_HOLIDAY"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const bonusRuleSchema = z.object({
  name: z.string().trim().min(1).default("Full Attendance Bonus"),
  amount: z.coerce.number().min(0),
  enabled: z.coerce.boolean().default(true),
  effectiveFrom: z.string().min(1),
});

export const pfRuleSchema = z.object({
  ratePercent: z.coerce.number().min(0).max(100),
  wageCeiling: z.coerce.number().min(0).optional().nullable(),
  enabled: z.coerce.boolean().default(true),
  effectiveFrom: z.string().min(1),
});

export const esiRuleSchema = z.object({
  ratePercent: z.coerce.number().min(0).max(100),
  wageCeiling: z.coerce.number().min(0).optional().nullable(),
  enabled: z.coerce.boolean().default(true),
  effectiveFrom: z.string().min(1),
});

export const ptRuleSchema = z.object({
  minSalary: z.coerce.number().min(0),
  maxSalary: z.coerce.number().min(0).optional().nullable(),
  ptAmount: z.coerce.number().min(0),
  enabled: z.coerce.boolean().default(true),
  effectiveFrom: z.string().min(1),
});

export const rttRuleSchema = z.object({
  amount: z.coerce.number().min(0),
  enabled: z.coerce.boolean().default(true),
  effectiveFrom: z.string().min(1),
});

export const userSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  role: z.enum(["ADMIN", "PAYROLL_MANAGER", "VIEWER"]),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
});

export const companySettingsSchema = z.object({
  companyName: z.string().trim().min(1),
  address: z.string().optional().or(z.literal("")),
  logoUrl: z.string().optional().or(z.literal("")),
  managerName: z.string().optional().or(z.literal("")),
  statutoryRef: z.string().optional().or(z.literal("")),
  weeklyOffDays: z.array(z.coerce.number().min(0).max(6)).default([0]),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Invalid email"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
