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
import { EmployeeIcon, EyeIcon } from "@/components/icons";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";

interface EmployeeRow {
  id: string;
  employeeCode: string;
  name: string;
  company: string;
  department: string | null;
  designation: string | null;
  status: string;
  salaryConfig: { monthlySalary: string } | null;
}

export default function DeactivatedEmployeesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [activateTarget, setActivateTarget] = useState<EmployeeRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["employees-deactivated", debouncedSearch, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20", status: "INACTIVE", company: "ALL" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/employees?${params}`);
      return res.json();
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["employees-deactivated"] });
    queryClient.invalidateQueries({ queryKey: ["employees"] });
  }

  async function handleActivate() {
    if (!activateTarget) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/employees/${activateTarget.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      if (res.ok) {
        setActivateTarget(null);
        refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Unable to activate employee");
        setActivateTarget(null);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const employees: EmployeeRow[] = data?.employees || [];

  return (
    <div className="space-y-4 max-w-6xl">
      <p className="text-sm text-navy-500">
        Deactivated employees are hidden from the active roster and excluded from future payroll runs, but their
        records and payroll history are preserved. Activate an employee here to bring them back onto the active list.
      </p>

      <Toolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search by name or department..." />

      {isLoading ? (
        <div className="card p-8 text-center text-sm text-navy-400">Loading deactivated employees...</div>
      ) : employees.length === 0 ? (
        <EmptyState
          title="No deactivated employees."
          description={debouncedSearch ? "Try a different search term." : "Employees you deactivate will show up here."}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Employee Name</th>
                <th>Company</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Monthly Salary</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, idx) => {
                const prefix = emp.company === "VPFL" ? "/vpfl" : "";
                return (
                  <tr key={emp.id}>
                    <td>{(page - 1) * 20 + idx + 1}</td>
                    <td>{emp.name}</td>
                    <td>{emp.company}</td>
                    <td>{emp.department || "—"}</td>
                    <td>{emp.designation || "—"}</td>
                    <td>
                      <CurrencyDisplay value={emp.salaryConfig?.monthlySalary || 0} />
                    </td>
                    <td>
                      <StatusBadge status={emp.status} />
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Link href={`${prefix}/employees/${emp.id}`} className="btn-ghost px-2 py-1" title="View">
                          <EyeIcon />
                        </Link>
                        <button className="btn-ghost px-2 py-1" title="Activate" onClick={() => setActivateTarget(emp)}>
                          <EmployeeIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-3">
            <Pagination page={page} pageSize={20} total={data?.total || 0} onPageChange={setPage} />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!activateTarget}
        title="Activate employee?"
        description={`${activateTarget?.name} will reappear on the active employee list and be included in future payroll runs.`}
        confirmLabel="Activate"
        onConfirm={handleActivate}
        onCancel={() => setActivateTarget(null)}
        busy={submitting}
      />
    </div>
  );
}
