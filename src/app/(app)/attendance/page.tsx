"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PeriodPicker } from "@/components/ui/PeriodPicker";
import { Toolbar } from "@/components/ui/Toolbar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ImportPanel } from "@/components/excel/ImportPanel";
import { FormDrawer } from "@/components/ui/FormDrawer";
import { PlusIcon } from "@/components/icons";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";

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
}

export default function AttendancePage() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [markOpen, setMarkOpen] = useState(false);
  const [markForm, setMarkForm] = useState({ employeeId: "", attendanceDate: "", status: "PRESENT" });
  const [markError, setMarkError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["attendance-summary", year, month, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ year: String(year), month: String(month) });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/attendance/summary?${params}`);
      return res.json();
    },
  });

  const { data: employeesData } = useQuery({
    queryKey: ["employees-all"],
    queryFn: async () => {
      const res = await fetch("/api/employees?pageSize=200");
      return res.json();
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["attendance-summary"] });
  }

  async function handleMarkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMarkError(null);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(markForm),
      });
      const resData = await res.json();
      if (!res.ok) {
        setMarkError(resData.error || "Unable to save attendance");
        return;
      }
      setMarkOpen(false);
      refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const rows: AttendanceRow[] = data?.rows || [];

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PeriodPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
        {data?.period && (
          <div className="text-xs text-navy-500">
            Working Days: <span className="font-semibold text-navy-800">{data.period.workingDays}</span>{" "}
            (total calendar days in the month) · Weekly Off {data.period.weeklyOffDays} · Holidays{" "}
            {data.period.holidayDays} <span className="text-navy-400">(reference only, not deducted)</span>
          </div>
        )}
      </div>

      <Toolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search by employee name...">
        <ImportPanel
          title="Import Attendance"
          fileName="attendance.xlsx"
          previewUrl="/api/import/attendance"
          confirmUrl="/api/import/attendance"
          templateUrl="/api/import/attendance/template"
          onImported={refresh}
        />
        <button className="btn-primary" onClick={() => { setMarkError(null); setMarkOpen(true); }}>
          <PlusIcon /> Add/Edit Attendance
        </button>
      </Toolbar>

      {isLoading ? (
        <div className="card p-8 text-center text-sm text-navy-400">Loading attendance...</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={`No attendance found for this month.`}
          description="Upload an attendance Excel file or add records manually."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
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
                <tr key={r.employeeId}>
                  <td className="font-medium text-navy-900">
                    {r.name}
                  </td>
                  <td>{r.workingDays}</td>
                  <td>{r.presentDays}</td>
                  <td>{r.actualAbsentDays}</td>
                  <td>{r.paidLeave}</td>
                  <td>{r.paidLeaveUsed}</td>
                  <td>{r.deductibleAbsentDays}</td>
                  <td className="font-medium">{r.payableDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FormDrawer open={markOpen} title="Add / Edit Attendance" onClose={() => setMarkOpen(false)} width="max-w-md">
        <form onSubmit={handleMarkSubmit} className="space-y-4">
          {markError && <div className="rounded-md bg-danger-50 text-danger-700 text-sm px-3 py-2">{markError}</div>}
          <div>
            <label className="label">Employee</label>
            <select
              className="input"
              value={markForm.employeeId}
              onChange={(e) => setMarkForm((f) => ({ ...f, employeeId: e.target.value }))}
              required
            >
              <option value="">Select employee</option>
              {(employeesData?.employees || []).map((e: { id: string; employeeCode: string; name: string }) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              className="input"
              value={markForm.attendanceDate}
              onChange={(e) => setMarkForm((f) => ({ ...f, attendanceDate: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={markForm.status}
              onChange={(e) => setMarkForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="WEEKLY_OFF">Weekly Off</option>
              <option value="HOLIDAY">Holiday</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-navy-100">
            <button type="button" className="btn-secondary" onClick={() => setMarkOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </FormDrawer>
    </div>
  );
}
