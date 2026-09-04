"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PeriodPicker } from "@/components/ui/PeriodPicker";
import { Toolbar } from "@/components/ui/Toolbar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ImportPanel } from "@/components/excel/ImportPanel";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useCompany } from "@/lib/hooks/useCompany";
import { computeAttendanceDerivedFields } from "@/lib/payroll/engine";
import { DownloadIcon } from "@/components/icons";

interface AttendanceRow {
  employeeId: string;
  employeeCode: string;
  name: string;
  department: string | null;
  workingDays: number;
  presentDays: number;
  actualAbsentDays: number;
  paidLeave: number;
  paidLeaveUsed: number;
  deductibleAbsentDays: number;
  payableDays: number;
  paidLeaveApplicable?: boolean;
}

function AttendanceRowItem({
  row,
  year,
  month,
  queryKey,
}: {
  row: AttendanceRow;
  year: number;
  month: number;
  queryKey: unknown[];
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(String(row.actualAbsentDays));
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (absentDays: number) => {
      const res = await fetch("/api/attendance/monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: row.employeeId, year, month, absentDays }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to save attendance");
      return data;
    },
    onMutate: async (absentDays: number) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: { period: unknown; rows: AttendanceRow[] } | undefined) => {
        if (!old) return old;
        return {
          ...old,
          rows: old.rows.map((r) => {
            if (r.employeeId !== row.employeeId) return r;
            const presentDays = r.workingDays - absentDays;
            const derived = computeAttendanceDerivedFields({
              workingDays: r.workingDays,
              presentDays,
              actualAbsentDays: absentDays,
              paidLeaveApplicable: r.paidLeaveApplicable ?? false,
            });
            return { ...r, presentDays, actualAbsentDays: absentDays, ...derived };
          }),
        };
      });

      return { prev };
    },
    onError: (e: Error, _absentDays, context) => {
      setError(e.message);
      setValue(String(row.actualAbsentDays));
      if (context?.prev) queryClient.setQueryData(queryKey, context.prev);
    },
    onSuccess: () => setError(null),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  function commit() {
    const n = parseInt(value, 10);
    if (Number.isNaN(n) || n < 0) {
      setError("Enter a valid number of days");
      setValue(String(row.actualAbsentDays));
      return;
    }
    if (n === row.actualAbsentDays) return;
    setError(null);
    mutation.mutate(n);
  }

  return (
    <tr>
      <td className="font-medium text-navy-900">{row.name}</td>
      <td>{row.workingDays}</td>
      <td>{row.presentDays}</td>
      <td>
        <input
          type="text"
          inputMode="numeric"
          className="input w-20 py-1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
        {error && <div className="text-danger-600 text-[11px] mt-0.5">{error}</div>}
      </td>
      <td>{row.paidLeave}</td>
      <td>{row.paidLeaveUsed}</td>
      <td>{row.deductibleAbsentDays}</td>
      <td className="font-medium">{row.payableDays}</td>
    </tr>
  );
}

export default function AttendancePage() {
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
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const queryKey = ["attendance-summary", company.code, year, month, debouncedSearch];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ year: String(year), month: String(month), company: company.code });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/attendance/summary?${params}`);
      return res.json();
    },
  });

  const rows: AttendanceRow[] = data?.rows || [];

  return (
    <div className="flex flex-col h-full gap-4 max-w-6xl">
      <div className="shrink-0 flex items-center justify-between flex-wrap gap-3">
        <PeriodPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
        <a
          href={`/api/export/attendance/excel?year=${year}&month=${month}&company=${company.code}`}
          className="btn-secondary"
          download
        >
          <DownloadIcon /> Download Attendance
        </a>
      </div>
      {data?.period && (
        <div className="shrink-0 text-xs text-navy-500">
          Working Days: <span className="font-semibold text-navy-800">{data.period.workingDays}</span>{" "}
          (total calendar days in the month) · Weekly Off {data.period.weeklyOffDays} · Holidays{" "}
          {data.period.holidayDays} <span className="text-navy-400">(reference only, not deducted)</span>
        </div>
      )}

      <div className="shrink-0">
        <Toolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search by employee name...">
          <ImportPanel
            title="Import Attendance"
            fileName="attendance.xlsx"
            previewUrl="/api/import/attendance"
            confirmUrl="/api/import/attendance"
            templateUrl="/api/import/attendance/template"
            onImported={() => {}}
          />
        </Toolbar>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center text-sm text-navy-400">Loading attendance...</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={`No attendance found for this month.`}
          description="Upload an attendance Excel file or enter Actual Absent Days directly in the table."
        />
      ) : (
        <>
        <p className="shrink-0 text-xs text-navy-500">
          Enter the number of Actual Absent Days for an employee — Present Days, Deductible Absent Days and Payable
          Days are calculated automatically.
        </p>
        <div className="card scroll-thick flex-1 min-h-0 overflow-auto">
          <table className="table-base table-sticky-head">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Working Days</th>
                <th>Present Days</th>
                <th>Actual Absent Days</th>
                <th>Paid Leave</th>
                <th>Paid Leave Used</th>
                <th>Deductible Absent Days</th>
                <th>Payable Days</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <AttendanceRowItem key={r.employeeId} row={r} year={year} month={month} queryKey={queryKey} />
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
