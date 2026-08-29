"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { PeriodPicker } from "@/components/ui/PeriodPicker";
import { Toolbar } from "@/components/ui/Toolbar";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ImportPanel } from "@/components/excel/ImportPanel";
import { DownloadIcon, EyeIcon, PrintIcon } from "@/components/icons";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { formatCurrencyINR } from "@/lib/date-utils";

interface PayrollRecordRow {
  id: string;
  employee: { id: string; employeeCode: string; name: string };
  monthlySalary: string;
  workingDays: number;
  presentDays: number;
  actualAbsentDays: number;
  paidLeave: number;
  paidLeaveUsed: number;
  deductibleAbsentDays: number;
  salaryAfterAbsence: string;
  bonus: string;
  esi: string;
  pf: string;
  pt: string;
  rtt: string;
  advance: string;
  canteenCharges: string;
  otDays: string;
  otAmount: string;
  netSalary: string;
  cashAmount: string;
  chequeAmount: string;
}

export default function SalarySheetsPage() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [generating, setGenerating] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: periodData, isLoading: periodLoading } = useQuery({
    queryKey: ["period", year, month],
    queryFn: async () => {
      const res = await fetch("/api/payroll/periods", { method: "GET" });
      const all = await res.json();
      const match = all.periods.find((p: { year: number; month: number }) => p.year === year && p.month === month);
      if (match) return match;
      const created = await fetch("/api/payroll/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });
      const data = await created.json();
      return data.period;
    },
  });

  const periodId: string | undefined = periodData?.id;

  const { data: recordsData, isLoading: recordsLoading, refetch } = useQuery({
    queryKey: ["payroll-records", periodId, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ periodId: periodId! });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/payroll/records?${params}`);
      return res.json();
    },
    enabled: !!periodId,
  });

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["period"] });
    setSelectedIds(new Set());
  }, [year, month, queryClient]);

  function toggleSelected(employeeId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }

  function toggleSelectAll(allEmployeeIds: string[]) {
    setSelectedIds((prev) => {
      const allSelected = allEmployeeIds.length > 0 && allEmployeeIds.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(allEmployeeIds);
    });
  }

  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: ["period"] });
    queryClient.invalidateQueries({ queryKey: ["payroll-records"] });
  }

  async function handleGenerate() {
    if (!periodId) return;
    setGenerating(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/payroll/periods/${periodId}/generate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Unable to generate payroll");
        refreshAll();
        return;
      }
      refreshAll();
    } finally {
      setGenerating(false);
    }
  }

  async function handleFinalize() {
    if (!periodId) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/payroll/periods/${periodId}/finalize`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Unable to finalize payroll");
        setFinalizeOpen(false);
        refreshAll();
        return;
      }
      setFinalizeOpen(false);
      refreshAll();
    } finally {
      setBusy(false);
    }
  }

  async function handleReopen() {
    if (!periodId) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/payroll/periods/${periodId}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reopenReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Unable to reopen payroll");
        setReopenOpen(false);
        refreshAll();
        return;
      }
      setReopenOpen(false);
      setReopenReason("");
      refreshAll();
    } finally {
      setBusy(false);
    }
  }

  const records: PayrollRecordRow[] = recordsData?.records || [];
  const isFinalized = periodData?.status === "FINALIZED";
  const allEmployeeIds = records.map((r) => r.employee.id);
  const allSelected = allEmployeeIds.length > 0 && allEmployeeIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;
  const employeeIdsQuery = someSelected ? `&employeeIds=${Array.from(selectedIds).join(",")}` : "";

  const totals = records.reduce(
    (acc, r) => ({
      salary: acc.salary + Number(r.salaryAfterAbsence),
      deductions:
        acc.deductions +
        Number(r.esi) +
        Number(r.pf) +
        Number(r.pt) +
        Number(r.rtt) +
        Number(r.advance) +
        Number(r.canteenCharges),
      net: acc.net + Number(r.netSalary),
      cash: acc.cash + Number(r.cashAmount),
      cheque: acc.cheque + Number(r.chequeAmount),
    }),
    { salary: 0, deductions: 0, net: 0, cash: 0, cheque: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PeriodPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
        <div className="flex items-center gap-2">
          {periodData && <StatusBadge status={periodData.status} />}
          <button className="btn-secondary" onClick={() => refetch()}>
            Refresh
          </button>
          {periodId && (
            <a
              href={`/api/export/payroll/excel?periodId=${periodId}${employeeIdsQuery}`}
              className="btn-secondary"
              download
            >
              <DownloadIcon /> Export Excel{someSelected ? ` (${selectedIds.size})` : ""}
            </a>
          )}
          {periodId && (
            <Link
              href={`/print/salary-sheet?periodId=${periodId}${employeeIdsQuery}`}
              className="btn-secondary"
              target="_blank"
            >
              <PrintIcon /> Print Salary Sheet{someSelected ? ` (${selectedIds.size})` : ""}
            </Link>
          )}
        </div>
      </div>

      {someSelected && (
        <div className="flex items-center justify-between rounded-md bg-navy-50 text-navy-700 text-xs px-3 py-2">
          <span>
            {selectedIds.size} of {records.length} employee(s) selected — Print and Export will only include the
            selected employees.
          </span>
          <button className="text-navy-500 hover:text-navy-800 font-medium" onClick={() => setSelectedIds(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      <Toolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search by employee name...">
        <ImportPanel
          title="Import Attendance (drives Salary Sheet)"
          fileName="attendance.xlsx"
          previewUrl="/api/import/attendance"
          confirmUrl="/api/import/attendance"
          templateUrl="/api/import/attendance/template"
          onImported={refreshAll}
        />
        {!isFinalized ? (
          <button className="btn-primary" onClick={handleGenerate} disabled={generating || !periodId}>
            {generating ? "Generating..." : "Generate Payroll"}
          </button>
        ) : null}
        {periodData?.status === "REVIEW" && (
          <button className="btn-primary" onClick={() => setFinalizeOpen(true)}>
            Finalize Payroll
          </button>
        )}
        {isFinalized && (
          <button className="btn-secondary" onClick={() => setReopenOpen(true)}>
            Reopen Payroll
          </button>
        )}
      </Toolbar>

      {actionError && <div className="rounded-md bg-danger-50 text-danger-700 text-sm px-3 py-2">{actionError}</div>}

      {periodLoading || recordsLoading ? (
        <div className="card p-8 text-center text-sm text-navy-400">Loading salary sheet...</div>
      ) : records.length === 0 ? (
        <EmptyState
          title="No payroll generated."
          description="Generate the salary sheet for this month to see calculated payroll."
          action={
            <button className="btn-primary" onClick={handleGenerate} disabled={generating}>
              {generating ? "Generating..." : "Generate Salary Sheet"}
            </button>
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th className="w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => toggleSelectAll(allEmployeeIds)}
                    aria-label="Select all employees"
                  />
                </th>
                <th>S.No</th>
                <th>Employee Name</th>
                <th>Total Salary</th>
                <th>Working Days</th>
                <th>Present Days</th>
                <th>Actual Absent</th>
                <th>Paid Leave</th>
                <th>Paid Leave Used</th>
                <th>Deductible Absent</th>
                <th>Salary After Absence</th>
                <th>Bonus</th>
                <th>ESI</th>
                <th>PF</th>
                <th>PT</th>
                <th>RTT</th>
                <th>Advance</th>
                <th>Canteen</th>
                <th>OT Days</th>
                <th>OT Amount</th>
                <th>Net Salary</th>
                <th>Net Cash</th>
                <th>Cheque Amount</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, idx) => (
                <tr key={r.id} className={selectedIds.has(r.employee.id) ? "bg-navy-50/60" : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.employee.id)}
                      onChange={() => toggleSelected(r.employee.id)}
                      aria-label={`Select ${r.employee.name}`}
                    />
                  </td>
                  <td>{idx + 1}</td>
                  <td className="font-medium text-navy-900">
                    {r.employee.name}
                  </td>
                  <td>{formatCurrencyINR(r.monthlySalary)}</td>
                  <td>{r.workingDays}</td>
                  <td>{r.presentDays}</td>
                  <td>{r.actualAbsentDays}</td>
                  <td>{r.paidLeave}</td>
                  <td>{r.paidLeaveUsed}</td>
                  <td>{r.deductibleAbsentDays}</td>
                  <td>{formatCurrencyINR(r.salaryAfterAbsence)}</td>
                  <td>{formatCurrencyINR(r.bonus)}</td>
                  <td>{formatCurrencyINR(r.esi)}</td>
                  <td>{formatCurrencyINR(r.pf)}</td>
                  <td>{formatCurrencyINR(r.pt)}</td>
                  <td>{formatCurrencyINR(r.rtt)}</td>
                  <td>{formatCurrencyINR(r.advance)}</td>
                  <td>{formatCurrencyINR(r.canteenCharges)}</td>
                  <td>{r.otDays}</td>
                  <td>{formatCurrencyINR(r.otAmount)}</td>
                  <td className="font-semibold text-navy-900">{formatCurrencyINR(r.netSalary)}</td>
                  <td>{formatCurrencyINR(r.cashAmount)}</td>
                  <td>{formatCurrencyINR(r.chequeAmount)}</td>
                  <td>
                    <div className="flex justify-end">
                      <Link href={`/salary-sheets/${r.id}`} className="btn-ghost px-2 py-1" title="View">
                        <EyeIcon />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold bg-navy-50/60">
                <td colSpan={10} className="text-right pr-3">
                  Totals
                </td>
                <td>{formatCurrencyINR(totals.salary)}</td>
                <td colSpan={8}></td>
                <td>{formatCurrencyINR(totals.deductions)}</td>
                <td>{formatCurrencyINR(totals.net)}</td>
                <td>{formatCurrencyINR(totals.cash)}</td>
                <td>{formatCurrencyINR(totals.cheque)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={finalizeOpen}
        title="Finalize Payroll?"
        description={`${records.length} employee(s) · Total Salary ${formatCurrencyINR(
          totals.salary
        )} · Total Deductions ${formatCurrencyINR(totals.deductions)} · Total Net Payable ${formatCurrencyINR(
          totals.net
        )}. Once finalized, payroll will be locked from editing.`}
        confirmLabel="Finalize"
        onConfirm={handleFinalize}
        onCancel={() => setFinalizeOpen(false)}
        busy={busy}
      />

      {reopenOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4">
          <div className="card w-full max-w-sm p-5">
            <h3 className="text-sm font-semibold text-navy-900">Reopen finalized payroll?</h3>
            <p className="text-xs text-navy-500 mt-1">A reason is required and will be recorded in the audit log.</p>
            <textarea
              className="input mt-3"
              rows={3}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Reason for reopening..."
            />
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn-secondary" onClick={() => setReopenOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleReopen} disabled={busy || !reopenReason.trim()}>
                {busy ? "Reopening..." : "Reopen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
