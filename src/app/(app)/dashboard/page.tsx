"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MonthButtonBar } from "@/components/ui/MonthButtonBar";
import { formatCurrencyINR, MONTH_NAMES } from "@/lib/date-utils";

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-navy-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold text-navy-900 mt-1">{value}</div>
      {hint && <div className="text-xs text-navy-400 mt-1">{hint}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Defaults to the current calendar month every time the dashboard opens —
  // it never carries over whatever month was last viewed.
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-summary", year, month],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/summary?year=${year}&month=${month}`);
      return res.json();
    },
  });

  const period = data?.period;
  const totals = data?.totals || { totalSalary: 0, totalDeductions: 0, totalNetPayable: 0, recordCount: 0 };
  const employeeCount = data?.employeeCount ?? 0;
  const isCurrentMonth = year === currentYear && month === currentMonth;

  return (
    <div className="space-y-6 max-w-6xl">
      <MonthButtonBar
        year={year}
        month={month}
        onChange={(y, m) => {
          setYear(y);
          setMonth(m);
        }}
        currentYear={currentYear}
        currentMonth={currentMonth}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Total Employees" value={String(employeeCount)} />
        <StatCard
          label="Current Payroll Month"
          value={`${MONTH_NAMES[month - 1]} ${year}`}
          hint={isCurrentMonth ? "Current month" : undefined}
        />
        <StatCard label="Working Days" value={period ? String(period.workingDays) : "—"} />
        <StatCard label="Total Salary" value={formatCurrencyINR(totals.totalSalary)} />
        <StatCard label="Total Deductions" value={formatCurrencyINR(totals.totalDeductions)} />
        <StatCard label="Total Net Payable" value={formatCurrencyINR(totals.totalNetPayable)} />
      </div>

      <div className="card p-5 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-navy-900">
            {MONTH_NAMES[month - 1]} {year} Payroll
          </div>
          <div className="text-xs text-navy-500 mt-0.5">
            {isLoading
              ? "Loading..."
              : period
              ? `${totals.recordCount} employee record(s) in ${period.status.toLowerCase()} status`
              : "No payroll period has been generated for this month yet"}
          </div>
        </div>
        <Link href="/salary-sheets" className="btn-primary">
          View Salary Sheet
        </Link>
      </div>
    </div>
  );
}
