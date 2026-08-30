"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { PeriodPicker } from "@/components/ui/PeriodPicker";
import { Toolbar } from "@/components/ui/Toolbar";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ImportPanel } from "@/components/excel/ImportPanel";
import { DownloadIcon, EyeIcon, PrintIcon } from "@/components/icons";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { formatCurrencyINR } from "@/lib/date-utils";

interface PayrollRecordRow {
  id: string;
  employee: { id: string; employeeCode: string; name: string };
  basicSalary: string;
  hra: string;
  conveyance: string;
  monthlySalary: string;
  workingDays: number;
  presentDays: number;
  actualAbsentDays: number;
  paidLeave: number;
  paidLeaveUsed: number;
  deductibleAbsentDays: number;
  payableDays: number;
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
  totalEarnings: string;
  totalDeductions: string;
  netSalary: string;
  cashAmount: string;
  chequeAmount: string;
}

function EditableAmount({
  value,
  onCommit,
  disabled,
  width = "w-20",
  step = "1",
  align = "right",
}: {
  value: number;
  onCommit: (n: number) => void;
  disabled?: boolean;
  width?: string;
  step?: string;
  align?: "left" | "right";
}) {
  const [local, setLocal] = useState(String(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocal(String(value));
    setError(null);
  }, [value]);

  function commit() {
    const n = Number(local);
    if (Number.isNaN(n) || n < 0) {
      setError("Invalid");
      setLocal(String(value));
      return;
    }
    setError(null);
    if (n === value) return;
    onCommit(n);
  }

  return (
    <div className="inline-block">
      <input
        type="number"
        min={0}
        step={step}
        disabled={disabled}
        className={`input py-1 px-1.5 text-xs ${width} ${align === "right" ? "text-right" : ""} disabled:bg-navy-50 disabled:text-navy-400`}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      {error && <div className="text-danger-600 text-[10px] leading-tight">{error}</div>}
    </div>
  );
}

function ReadCell({ value, emphasis }: { value: React.ReactNode; emphasis?: boolean }) {
  return <span className={emphasis ? "font-semibold text-navy-900" : ""}>{value}</span>;
}

function SalarySheetRow({
  record,
  index,
  year,
  month,
  selected,
  onToggle,
  isFinalized,
  onChanged,
}: {
  record: PayrollRecordRow;
  index: number;
  year: number;
  month: number;
  selected: boolean;
  onToggle: () => void;
  isFinalized: boolean;
  onChanged: () => void;
}) {
  const [rowError, setRowError] = useState<string | null>(null);
  const disabled = isFinalized;

  async function post(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Unable to save");
    return data;
  }

  const mutAbsentDays = useMutation({
    mutationFn: async (absentDays: number) => {
      await post("/api/attendance/monthly", { employeeId: record.employee.id, year, month, absentDays });
      return post(`/api/payroll/records/${record.id}`, {});
    },
    onSuccess: () => {
      setRowError(null);
      onChanged();
    },
    onError: (e: Error) => setRowError(e.message),
  });

  const mutExtras = useMutation({
    mutationFn: (vals: { canteenCharges: number; otDays: number }) =>
      post(`/api/payroll/records/${record.id}/extras`, vals),
    onSuccess: () => {
      setRowError(null);
      onChanged();
    },
    onError: (e: Error) => setRowError(e.message),
  });

  const mutAdvance = useMutation({
    mutationFn: (amount: number) => post(`/api/payroll/records/${record.id}/advance`, { amount }),
    onSuccess: () => {
      setRowError(null);
      onChanged();
    },
    onError: (e: Error) => setRowError(e.message),
  });

  const mutPayment = useMutation({
    mutationFn: (chequeAmount: number) => post(`/api/payroll/records/${record.id}/payment`, { chequeAmount }),
    onSuccess: () => {
      setRowError(null);
      onChanged();
    },
    onError: (e: Error) => setRowError(e.message),
  });

  const stickyBg = selected ? "!bg-navy-100" : "!bg-white";

  return (
    <tr className={selected ? "bg-navy-50/60" : undefined}>
      <td className={`sticky left-0 z-[5] w-10 min-w-[40px] max-w-[40px] ${stickyBg}`}>
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${record.employee.name}`} />
      </td>
      <td className={`sticky left-10 z-[5] w-14 min-w-[56px] max-w-[56px] ${stickyBg}`}>{index + 1}</td>
      <td
        className={`sticky left-[96px] z-[5] w-[220px] min-w-[220px] max-w-[220px] truncate font-medium text-navy-900 whitespace-nowrap border-r border-navy-200 ${stickyBg}`}
        title={record.employee.name}
      >
        {record.employee.name}
        {rowError && <div className="text-danger-600 text-[10px] font-normal whitespace-normal">{rowError}</div>}
      </td>

      {/* Rate of Pay — edited from the Employees page, read-only here */}
      <td>
        <ReadCell value={formatCurrencyINR(record.basicSalary)} />
      </td>
      <td>
        <ReadCell value={formatCurrencyINR(record.hra)} />
      </td>
      <td>
        <ReadCell value={formatCurrencyINR(record.conveyance)} />
      </td>
      <td>
        <ReadCell value={formatCurrencyINR(record.monthlySalary)} emphasis />
      </td>

      {/* Attendance */}
      <td>
        <ReadCell value={record.workingDays} />
      </td>
      <td>
        <ReadCell value={record.presentDays} />
      </td>
      <td>
        <EditableAmount
          value={record.actualAbsentDays}
          disabled={disabled}
          width="w-16"
          onCommit={(n) => mutAbsentDays.mutate(n)}
        />
      </td>
      <td>
        <ReadCell value={record.paidLeave} />
      </td>
      <td>
        <ReadCell value={record.paidLeaveUsed} />
      </td>
      <td>
        <ReadCell value={record.deductibleAbsentDays} />
      </td>
      <td>
        <ReadCell value={record.payableDays} emphasis />
      </td>

      {/* Earned Salary */}
      <td>
        <ReadCell value={formatCurrencyINR(record.salaryAfterAbsence)} />
      </td>
      <td>
        <ReadCell value={formatCurrencyINR(record.bonus)} />
      </td>
      <td>
        <EditableAmount
          value={Number(record.otDays)}
          disabled={disabled}
          width="w-14"
          step="0.5"
          onCommit={(n) => mutExtras.mutate({ canteenCharges: Number(record.canteenCharges), otDays: n })}
        />
      </td>
      <td>
        <ReadCell value={formatCurrencyINR(record.otAmount)} />
      </td>
      <td>
        <ReadCell value={formatCurrencyINR(record.totalEarnings)} emphasis />
      </td>

      {/* Deductions */}
      <td>
        <ReadCell value={formatCurrencyINR(record.pf)} />
      </td>
      <td>
        <ReadCell value={formatCurrencyINR(record.esi)} />
      </td>
      <td>
        <ReadCell value={formatCurrencyINR(record.pt)} />
      </td>
      <td>
        <ReadCell value={formatCurrencyINR(record.rtt)} />
      </td>
      <td>
        <EditableAmount value={Number(record.advance)} disabled={disabled} onCommit={(n) => mutAdvance.mutate(n)} />
      </td>
      <td>
        <EditableAmount
          value={Number(record.canteenCharges)}
          disabled={disabled}
          onCommit={(n) => mutExtras.mutate({ canteenCharges: n, otDays: Number(record.otDays) })}
        />
      </td>
      <td>
        <ReadCell value={formatCurrencyINR(record.totalDeductions)} emphasis />
      </td>

      {/* Net Salary */}
      <td>
        <ReadCell value={formatCurrencyINR(record.netSalary)} emphasis />
      </td>

      {/* Payment */}
      <td>
        <ReadCell value={formatCurrencyINR(record.cashAmount)} />
      </td>
      <td>
        <EditableAmount
          value={Number(record.chequeAmount)}
          disabled={disabled}
          onCommit={(n) => mutPayment.mutate(n)}
        />
      </td>

      <td>
        <div className="flex justify-end">
          <Link href={`/salary-sheets/${record.id}`} className="btn-ghost px-2 py-1" title="View">
            <EyeIcon />
          </Link>
        </div>
      </td>
    </tr>
  );
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
      rateOfPay: acc.rateOfPay + Number(r.monthlySalary),
      salary: acc.salary + Number(r.salaryAfterAbsence),
      earnings: acc.earnings + Number(r.totalEarnings),
      deductions: acc.deductions + Number(r.totalDeductions),
      net: acc.net + Number(r.netSalary),
      cash: acc.cash + Number(r.cashAmount),
      cheque: acc.cheque + Number(r.chequeAmount),
    }),
    { rateOfPay: 0, salary: 0, earnings: 0, deductions: 0, net: 0, cash: 0, cheque: 0 }
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

      {isFinalized && (
        <div className="rounded-md bg-navy-50 text-navy-600 text-xs px-3 py-2">
          This payroll is finalized, so the sheet below is read-only. Click <strong>Reopen Payroll</strong> to edit
          any figure again.
        </div>
      )}
      {!isFinalized && (
        <div className="rounded-md bg-navy-50 text-navy-600 text-xs px-3 py-2">
          Actual Absent, OT Days, Advance, Canteen Charges and Cheque Amount are editable directly in the cell below —
          click in, type, and tab or click away to save. Basic Salary, HRA and Conveyance are edited from the
          Employees page. Statutory figures (PF, ESI, PT, RTT) and totals are calculated automatically.
        </div>
      )}

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
          <table className="table-base !border-separate border-spacing-0">
            <thead className="sticky top-14 z-[8]">
              <tr>
                <th className="sticky left-0 z-[6] w-10 min-w-[40px] max-w-[40px] !bg-navy-50" rowSpan={2}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => toggleSelectAll(allEmployeeIds)}
                    aria-label="Select all employees"
                  />
                </th>
                <th className="sticky left-10 z-[6] w-14 min-w-[56px] max-w-[56px] !bg-navy-50" rowSpan={2}>
                  S.No
                </th>
                <th
                  className="sticky left-[96px] z-[6] w-[220px] min-w-[220px] max-w-[220px] !bg-navy-50 border-r border-navy-200"
                  rowSpan={2}
                >
                  Employee Name
                </th>
                <th colSpan={4} className="text-center border-l border-navy-200 !bg-navy-50">
                  Rate of Pay
                </th>
                <th colSpan={7} className="text-center border-l border-navy-200 !bg-navy-50">
                  Attendance
                </th>
                <th colSpan={5} className="text-center border-l border-navy-200 !bg-navy-50">
                  Earned Salary
                </th>
                <th colSpan={7} className="text-center border-l border-navy-200 !bg-navy-50">
                  Deductions
                </th>
                <th rowSpan={2} className="border-l border-navy-200 !bg-navy-50">
                  Net Salary
                </th>
                <th colSpan={2} className="text-center border-l border-navy-200 !bg-navy-50">
                  Payment
                </th>
                <th className="text-right !bg-navy-50" rowSpan={2}>
                  Action
                </th>
              </tr>
              <tr>
                <th className="border-l border-navy-200 !bg-navy-50">Basic Salary</th>
                <th className="!bg-navy-50">HRA</th>
                <th className="!bg-navy-50">Conveyance</th>
                <th className="!bg-navy-50">Total</th>
                <th className="border-l border-navy-200 !bg-navy-50">Working Days</th>
                <th className="!bg-navy-50">Present Days</th>
                <th className="!bg-navy-50">Actual Absent</th>
                <th className="!bg-navy-50">Paid Leave</th>
                <th className="!bg-navy-50">Paid Leave Used</th>
                <th className="!bg-navy-50">Deductible Absent</th>
                <th className="!bg-navy-50">Payable Days</th>
                <th className="border-l border-navy-200 !bg-navy-50">Salary After Absence</th>
                <th className="!bg-navy-50">Bonus</th>
                <th className="!bg-navy-50">OT Days</th>
                <th className="!bg-navy-50">OT Amount</th>
                <th className="!bg-navy-50">Total Earnings</th>
                <th className="border-l border-navy-200 !bg-navy-50">PF</th>
                <th className="!bg-navy-50">ESI</th>
                <th className="!bg-navy-50">PT</th>
                <th className="!bg-navy-50">RTT</th>
                <th className="!bg-navy-50">Advance</th>
                <th className="!bg-navy-50">Canteen</th>
                <th className="!bg-navy-50">Total</th>
                <th className="border-l border-navy-200 !bg-navy-50">Net Cash</th>
                <th className="!bg-navy-50">Cheque Amount</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, idx) => (
                <SalarySheetRow
                  key={r.id}
                  record={r}
                  index={idx}
                  year={year}
                  month={month}
                  selected={selectedIds.has(r.employee.id)}
                  onToggle={() => toggleSelected(r.employee.id)}
                  isFinalized={isFinalized}
                  onChanged={refreshAll}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold bg-navy-50/60">
                <td colSpan={6} className="text-right pr-3">
                  Totals
                </td>
                <td>{formatCurrencyINR(totals.rateOfPay)}</td>
                <td colSpan={7}></td>
                <td>{formatCurrencyINR(totals.salary)}</td>
                <td colSpan={3}></td>
                <td>{formatCurrencyINR(totals.earnings)}</td>
                <td colSpan={6}></td>
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
        description={`${records.length} employee(s) · Total Earnings ${formatCurrencyINR(
          totals.earnings
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
