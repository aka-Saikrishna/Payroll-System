"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Toolbar } from "@/components/ui/Toolbar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormDrawer } from "@/components/ui/FormDrawer";
import { ImportPanel } from "@/components/excel/ImportPanel";
import { EmployeeForm } from "./EmployeeForm";
import { PlusIcon, EditIcon, EmployeeOffIcon, EyeIcon } from "@/components/icons";
import { EmployeeInput } from "@/lib/validation/employee";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useCompany } from "@/lib/hooks/useCompany";

interface EmployeeRow {
  id: string;
  employeeCode: string;
  name: string;
  department: string | null;
  designation: string | null;
  status: string;
  salaryConfig: {
    monthlySalary: string;
    basicSalary: string;
    hra: string;
    conveyance: string;
    pfApplicable: boolean;
    esiApplicable: boolean;
    ptApplicable: boolean;
    paidLeaveApplicable: boolean;
  } | null;
}

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const company = useCompany();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<EmployeeRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["employees", company.code, debouncedSearch, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "100", status: "ACTIVE", company: company.code });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/employees?${params}`);
      return res.json();
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["employees"] });
  }

  async function handleSubmit(values: EmployeeInput) {
    setSubmitting(true);
    setFormError(null);
    try {
      const url = editing ? `/api/employees/${editing.id}` : "/api/employees";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, company: company.code }),
      });
      const resData = await res.json();
      if (!res.ok) {
        setFormError(resData.error || "Unable to save employee");
        return;
      }
      setDrawerOpen(false);
      setEditing(null);
      refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/employees/${deactivateTarget.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "INACTIVE" }),
      });
      if (res.ok) {
        setDeactivateTarget(null);
        refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Unable to deactivate employee");
        setDeactivateTarget(null);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const employees: EmployeeRow[] = data?.employees || [];

  return (
    <div className="space-y-4 max-w-6xl">
      <Toolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search by name...">
        <ImportPanel
          title="Import Employees"
          fileName="employees.xlsx"
          previewUrl="/api/import/employees"
          confirmUrl="/api/import/employees"
          templateUrl="/api/import/employees/template"
          onImported={refresh}
        />
        <button
          className="btn-primary"
          onClick={() => {
            setEditing(null);
            setFormError(null);
            setDrawerOpen(true);
          }}
        >
          <PlusIcon /> Add Employee
        </button>
      </Toolbar>

      {isLoading ? (
        <div className="card p-8 text-center text-sm text-navy-400">Loading employees...</div>
      ) : employees.length === 0 ? (
        <EmptyState
          title="No employees found."
          description={debouncedSearch ? "Try a different search term." : "Add your first employee or import from Excel."}
          action={
            <button className="btn-primary" onClick={() => setDrawerOpen(true)}>
              <PlusIcon /> Add Employee
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Employee Name</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Monthly Salary</th>
                <th>Paid Leave</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, idx) => (
                <tr key={emp.id}>
                  <td>{(page - 1) * 100 + idx + 1}</td>
                  <td>{emp.name}</td>
                  <td>{emp.department || "—"}</td>
                  <td>{emp.designation || "—"}</td>
                  <td>
                    <CurrencyDisplay value={emp.salaryConfig?.monthlySalary || 0} />
                  </td>
                  <td>
                    {emp.salaryConfig?.paidLeaveApplicable ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        ✓ Enabled
                      </span>
                    ) : (
                      <span className="text-navy-300">—</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={emp.status} />
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <Link href={`${company.prefix}/employees/${emp.id}`} className="btn-ghost px-2 py-1" title="View">
                        <EyeIcon />
                      </Link>
                      <button
                        className="btn-ghost px-2 py-1"
                        title="Edit"
                        onClick={() => {
                          setEditing(emp);
                          setFormError(null);
                          setDrawerOpen(true);
                        }}
                      >
                        <EditIcon />
                      </button>
                      <button className="btn-ghost px-2 py-1" title="Deactivate" onClick={() => setDeactivateTarget(emp)}>
                        <EmployeeOffIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3">
            <Pagination page={page} pageSize={100} total={data?.total || 0} onPageChange={setPage} />
          </div>
        </div>
      )}

      <FormDrawer
        open={drawerOpen}
        title={editing ? "Edit Employee" : "Add Employee"}
        onClose={() => setDrawerOpen(false)}
      >
        {formError && <div className="rounded-md bg-danger-50 text-danger-700 text-sm px-3 py-2 mb-4">{formError}</div>}
        <EmployeeForm
          defaultValues={
            editing
              ? {
                  employeeCode: editing.employeeCode,
                  name: editing.name,
                  department: editing.department || "",
                  designation: editing.designation || "",
                  status: editing.status as "ACTIVE" | "INACTIVE",
                  basicSalary: Number(editing.salaryConfig?.basicSalary || 0),
                  hra: Number(editing.salaryConfig?.hra || 0),
                  conveyance: Number(editing.salaryConfig?.conveyance || 0),
                  pfApplicable: editing.salaryConfig?.pfApplicable ?? false,
                  esiApplicable: editing.salaryConfig?.esiApplicable ?? false,
                  ptApplicable: editing.salaryConfig?.ptApplicable ?? true,
                  paidLeaveApplicable: editing.salaryConfig?.paidLeaveApplicable ?? false,
                }
              : undefined
          }
          onSubmit={handleSubmit}
          onCancel={() => setDrawerOpen(false)}
          submitting={submitting}
        />
      </FormDrawer>

      <ConfirmDialog
        open={!!deactivateTarget}
        title="Deactivate employee?"
        description={`${deactivateTarget?.name} will be hidden from the active employee list and excluded from future payroll runs. Their records are kept and they can be reactivated any time from Deactivated Employees.`}
        destructive
        confirmLabel="Deactivate"
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateTarget(null)}
        busy={submitting}
      />
    </div>
  );
}
