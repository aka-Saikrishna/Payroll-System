import { z } from "zod";

export const employeeSchema = z.object({
  // Employee ID is no longer entered manually — the backend auto-generates
  // it on creation and it is left untouched on edits. Kept optional here
  // (rather than removed) so direct API/Excel-import callers can still pass
  // an explicit code if needed.
  // employeeCode: z.string().trim().min(1, "Employee ID is required"),
  employeeCode: z.string().trim().optional().or(z.literal("")),
  name: z.string().trim().min(1, "Employee name is required"),
  mobile: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  department: z.string().trim().optional().or(z.literal("")),
  designation: z.string().trim().optional().or(z.literal("")),
  joiningDate: z.string().trim().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  // Rate of Pay breakup (Register of Wages format). Total (monthlySalary) is
  // always computed server-side as basicSalary + hra + conveyance.
  basicSalary: z.coerce.number().min(0, "Basic salary cannot be negative"),
  hra: z.coerce.number().min(0, "HRA cannot be negative").default(0),
  conveyance: z.coerce.number().min(0, "Conveyance cannot be negative").default(0),
  pfApplicable: z.coerce.boolean().default(false),
  esiApplicable: z.coerce.boolean().default(false),
  ptApplicable: z.coerce.boolean().default(true),
  paidLeaveApplicable: z.coerce.boolean().default(false),
});

export type EmployeeInput = z.infer<typeof employeeSchema>;
