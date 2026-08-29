"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { employeeSchema, EmployeeInput } from "@/lib/validation/employee";
import { useEffect } from "react";
import { formatCurrencyINR } from "@/lib/date-utils";

export function EmployeeForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitting,
}: {
  defaultValues?: Partial<EmployeeInput>;
  onSubmit: (values: EmployeeInput) => void;
  onCancel: () => void;
  submitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<EmployeeInput>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      status: "ACTIVE",
      basicSalary: 0,
      hra: 0,
      conveyance: 0,
      pfApplicable: false,
      esiApplicable: false,
      ptApplicable: true,
      rttApplicable: false,
      paidLeaveApplicable: false,
      ...defaultValues,
    },
  });

  useEffect(() => {
    reset({
      status: "ACTIVE",
      basicSalary: 0,
      hra: 0,
      conveyance: 0,
      pfApplicable: false,
      esiApplicable: false,
      ptApplicable: true,
      rttApplicable: false,
      paidLeaveApplicable: false,
      ...defaultValues,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues]);

  const [basicSalary, hra, conveyance] = useWatch({ control, name: ["basicSalary", "hra", "conveyance"] });
  const total = (Number(basicSalary) || 0) + (Number(hra) || 0) + (Number(conveyance) || 0);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-navy-500">Personal Information</h3>
        {/*
          Employee ID is hidden from the UI entirely. It is still generated and
          stored on the record (see generateNextEmployeeCode in
          src/lib/employeeCode.ts) because it is the stable business key used
          to match rows on Excel import, but it is never shown or edited here.
          Original manual-entry field kept commented out in case it needs to
          come back:

          <div>
            <label className="label">Employee ID</label>
            <input className="input" {...register("employeeCode")} />
            {errors.employeeCode && <p className="text-xs text-danger-500 mt-1">{errors.employeeCode.message}</p>}
          </div>
        */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Employee Name</label>
            <input className="input" {...register("name")} />
            {errors.name && <p className="text-xs text-danger-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Mobile</label>
            <input className="input" {...register("mobile")} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" {...register("email")} />
            {errors.email && <p className="text-xs text-danger-500 mt-1">{errors.email.message}</p>}
          </div>
          <div className="col-span-2">
            <label className="label">Address</label>
            <input className="input" {...register("address")} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-navy-500">Employment Information</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Department</label>
            <input className="input" {...register("department")} />
          </div>
          <div>
            <label className="label">Designation</label>
            <input className="input" {...register("designation")} />
          </div>
          <div>
            <label className="label">Joining Date</label>
            <input type="date" className="input" {...register("joiningDate")} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" {...register("status")}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-navy-500">Salary Information (Rate of Pay)</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Basic Salary</label>
            <input type="number" step="0.01" className="input" {...register("basicSalary")} />
            {errors.basicSalary && <p className="text-xs text-danger-500 mt-1">{errors.basicSalary.message}</p>}
          </div>
          <div>
            <label className="label">HRA</label>
            <input type="number" step="0.01" className="input" {...register("hra")} />
            {errors.hra && <p className="text-xs text-danger-500 mt-1">{errors.hra.message}</p>}
          </div>
          <div>
            <label className="label">Conveyance</label>
            <input type="number" step="0.01" className="input" {...register("conveyance")} />
            {errors.conveyance && <p className="text-xs text-danger-500 mt-1">{errors.conveyance.message}</p>}
          </div>
        </div>
        <div className="flex items-center justify-between rounded-md bg-navy-50 px-3 py-2">
          <span className="text-xs font-medium text-navy-600">Total (Monthly Salary)</span>
          <span className="text-sm font-semibold text-navy-900">{formatCurrencyINR(total)}</span>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-navy-500">Payroll Configuration</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm text-navy-700">
            <input type="checkbox" {...register("pfApplicable")} /> PF Applicable
          </label>
          <label className="flex items-center gap-2 text-sm text-navy-700">
            <input type="checkbox" {...register("esiApplicable")} /> ESI Applicable
          </label>
          <label className="flex items-center gap-2 text-sm text-navy-700">
            <input type="checkbox" {...register("ptApplicable")} /> PT Applicable
          </label>
          <label className="flex items-center gap-2 text-sm text-navy-700">
            <input type="checkbox" {...register("rttApplicable")} /> RTT Applicable
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-navy-500">Leave Entitlement</h3>
        <label className="flex items-start gap-2 text-sm text-navy-700">
          <input type="checkbox" className="mt-0.5" {...register("paidLeaveApplicable")} />
          <span>
            1 paid leave per month
            <span className="block text-xs text-navy-400 mt-0.5">
              When enabled, this employee&apos;s first absence each month is forgiven and not deducted from salary. When
              off, every absent day is deducted.
            </span>
          </span>
        </label>
      </section>

      <div className="flex justify-end gap-2 pt-2 border-t border-navy-100">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
