"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PeriodPicker } from "@/components/ui/PeriodPicker";
import { EmptyState } from "@/components/ui/EmptyState";
import { DownloadIcon } from "@/components/icons";
import { useCompany } from "@/lib/hooks/useCompany";
import { formatCurrencyINR } from "@/lib/date-utils";

type ReportType = "salary" | "deduction" | "attendance" | "advance" | "bonus";

const REPORT_TABS: { key: ReportType; label: string }[] = [
  { key: "salary", label: "Monthly Salary Report" },
  { key: "deduction", label: "Deduction Report" },
  { key: "attendance", label: "Attendance Report" },
  { key: "advance", label: "Advance Report" },
  { key: "bonus", label: "Bonus Report" },
];

export default function ReportsPage() {
  const company = useCompany();
  const now = new Date();
  const defaultMonth = now.getDate() < 15
    ? (now.getMonth() === 0 ? 12 : now.getMonth())
    : now.getMonth() + 1;
  const defaultYear = now.getDate() < 15 && now.getMonth() === 0
    ? now.getFullYear() - 1
    : now.getFullYear();
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [reportType, setReportType] = useState<ReportType>("salary");
  const [search, setSearch] = useState("");

  const { data: periodData } = useQuery({
    queryKey: ["report-period", year, month],
    queryFn: async () => {
      const res = await fetch("/api/payroll/periods");
      const all = await res.json();
      return all.periods.find((p: { year: number; month: number }) => p.year === year && p.month === month) || null;
    },
  });

  const periodId = periodData?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["report-records", periodId, company.code],
    queryFn: async () => {
      const res = await fetch(`/api/payroll/records?periodId=${periodId}&company=${company.code}`);
      return res.json();
    },
    enabled: !!periodId,
  });

  interface RecordRow {
    id: string;
    employee: { employeeCode: string; name: string; department: string | null };
    monthlySalary: string;
    workingDays: number;
    presentDays: number;
    actualAbsentDays: number;
    deductibleAbsentDays: number;
    salaryAfterAbsence: string;
    bonus: string;
    bonusEligible: boolean;
    esi: string;
    pf: string;
    pt: string;
    advance: string;
    netSalary: string;
  }

  const records: RecordRow[] = (data?.records || []).filter(
    (r: RecordRow) => !search || r.employee.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PeriodPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
        {periodId && (
          <a href={`/api/export/payroll/excel?periodId=${periodId}`} className="btn-secondary" download>
            <DownloadIcon /> Export Excel
          </a>
        )}
      </div>

      <div className="flex gap-1 border-b border-navy-100 overflow-x-auto">
        {REPORT_TABS.map((t) => (
          <button
            key={t.key}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
              reportType === t.key ? "border-navy-800 text-navy-900" : "border-transparent text-navy-400 hover:text-navy-700"
            }`}
            onClick={() => setReportType(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <input
        className="input max-w-xs"
        placeholder="Search by employee..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {isLoading ? (
        <div className="card p-8 text-center text-sm text-navy-400">Loading report...</div>
      ) : records.length === 0 ? (
        <EmptyState title="No data for this period." description="Generate payroll for this month first." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                {reportType === "salary" && (
                  <>
                    <th>Total Salary</th>
                    <th>Salary After Absence</th>
                    <th>Net Salary</th>
                  </>
                )}
                {reportType === "deduction" && (
                  <>
                    <th>ESI</th>
                    <th>PF</th>
                    <th>PT</th>
                  </>
                )}
                {reportType === "attendance" && (
                  <>
                    <th>Working Days</th>
                    <th>Present Days</th>
                    <th>Actual Absent</th>
                    <th>Deductible Absent</th>
                  </>
                )}
                {reportType === "advance" && <th>Advance</th>}
                {reportType === "bonus" && (
                  <>
                    <th>Eligible</th>
                    <th>Bonus Amount</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium text-navy-900">
                    {r.employee.name}
                  </td>
                  <td>{r.employee.department || "—"}</td>
                  {reportType === "salary" && (
                    <>
                      <td>{formatCurrencyINR(r.monthlySalary)}</td>
                      <td>{formatCurrencyINR(r.salaryAfterAbsence)}</td>
                      <td className="font-semibold">{formatCurrencyINR(r.netSalary)}</td>
                    </>
                  )}
                  {reportType === "deduction" && (
                    <>
                      <td>{formatCurrencyINR(r.esi)}</td>
                      <td>{formatCurrencyINR(r.pf)}</td>
                      <td>{formatCurrencyINR(r.pt)}</td>
                    </>
                  )}
                  {reportType === "attendance" && (
                    <>
                      <td>{r.workingDays}</td>
                      <td>{r.presentDays}</td>
                      <td>{r.actualAbsentDays}</td>
                      <td>{r.deductibleAbsentDays}</td>
                    </>
                  )}
                  {reportType === "advance" && <td>{formatCurrencyINR(r.advance)}</td>}
                  {reportType === "bonus" && (
                    <>
                      <td>{r.bonusEligible ? "Yes" : "No"}</td>
                      <td>{formatCurrencyINR(r.bonus)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
