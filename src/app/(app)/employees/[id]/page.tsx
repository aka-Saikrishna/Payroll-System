"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MONTH_NAMES, formatDate } from "@/lib/date-utils";
import { useCompany } from "@/lib/hooks/useCompany";

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const company = useCompany();

  const { data, isLoading } = useQuery({
    queryKey: ["employee", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${params.id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const { data: historyData } = useQuery({
    queryKey: ["employee-history", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${params.id}/payroll-history`);
      return res.json();
    },
  });

  if (isLoading) return <div className="text-sm text-navy-400">Loading...</div>;
  const employee = data?.employee;
  if (!employee) return <div className="text-sm text-navy-400">Employee not found.</div>;

  const history: { id: string; year: number; month: number; netSalary: string; status: string }[] =
    historyData?.records || [];

  return (
    <div className="max-w-4xl space-y-6">
      <button className="text-xs text-navy-500 hover:text-navy-800" onClick={() => router.back()}>
        ← Back
      </button>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-navy-900">{employee.name}</h2>
            <p className="text-xs text-navy-500 mt-0.5">
              {employee.department || "—"} · {employee.designation || "—"}
            </p>
          </div>
          <StatusBadge status={employee.status} />
        </div>

        <div className="grid grid-cols-3 gap-4 mt-5 text-sm">
          <div>
            <div className="text-xs text-navy-400">Mobile</div>
            <div>{employee.mobile || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-navy-400">Email</div>
            <div>{employee.email || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-navy-400">Joining Date</div>
            <div>{employee.joiningDate ? formatDate(employee.joiningDate) : "—"}</div>
          </div>
          <div>
            <div className="text-xs text-navy-400">Monthly Salary</div>
            <CurrencyDisplay value={employee.salaryConfig?.monthlySalary || 0} emphasis />
          </div>
          <div>
            <div className="text-xs text-navy-400">PF / ESI</div>
            <div>
              {employee.salaryConfig?.pfApplicable ? "PF" : "—"} / {employee.salaryConfig?.esiApplicable ? "ESI" : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs text-navy-400">PT / RTT</div>
            <div>
              {employee.salaryConfig?.ptApplicable ? "PT" : "—"} / {employee.salaryConfig?.rttApplicable ? "RTT" : "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-navy-900 mb-3">Salary History</h3>
        {history.length === 0 ? (
          <p className="text-sm text-navy-400">No payroll history yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {history.map((r) => (
              <Link
                key={r.id}
                href={`${company.prefix}/salary-sheets/${r.id}`}
                className="border border-navy-100 rounded-md p-3 hover:border-navy-300 transition-colors"
              >
                <div className="text-sm font-medium text-navy-900">
                  {MONTH_NAMES[r.month - 1]} {r.year}
                </div>
                <CurrencyDisplay value={r.netSalary} className="text-xs text-navy-500" />
                <div className="mt-1">
                  <StatusBadge status={r.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
