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
import { useCompany } from "@/lib/hooks/useCompany";
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
  dailyRate: string;
  salaryAfterAbsence: string;
  bonus: string;
  esi: string;
  pf: string;
  pt: string;
  advance: string;
  canteenCharges: string;
  otDays: string;
  otAmount: string;
  otherAmount: string;
  totalEarnings: string;
  totalDeductions: string;
  netSalary: string;
  cashAmount: string;
  chequeAmount: string;
}

function r2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function r10(n: number) {
  const rounded = Math.round(n);
  const rem = ((rounded % 10) + 10) % 10;
  return rem < 5 ? rounded - rem : rounded + (10 - rem);
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
        type="text"
        inputMode="numeric"
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
  bonusEnabled,
  onChanged,
  linkPrefix,
  recordsQueryKey,
}: {
  record: PayrollRecordRow;
  index: number;
  year: number;
  month: number;
  selected: boolean;
  onToggle: () => void;
  isFinalized: boolean;
  onChanged: () => void;
  linkPrefix: string;
  recordsQueryKey: unknown[];
  bonusEnabled: boolean;
}) {
  const queryClient = useQueryClient();
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

  function patchRecord(updated: Partial<PayrollRecordRow>) {
    queryClient.setQueryData(recordsQueryKey, (old: { records: PayrollRecordRow[] } | undefined) => {
      if (!old) return old;
      return {
        ...old,
        records: old.records.map((r) => (r.id === record.id ? { ...r, ...updated } : r)),
      };
    });
  }

  const mutExtras = useMutation({
    mutationFn: (vals: { canteenCharges: number; otDays: number; otherAmount: number; bonus?: number }) =>
      post(`/api/payroll/records/${record.id}/extras`, vals),
    onMutate: async (vals) => {
      await queryClient.cancelQueries({ queryKey: recordsQueryKey });
      const prev = queryClient.getQueryData(recordsQueryKey);
      const otAmount = r10(vals.otDays * Number(record.dailyRate));
      const bonus = vals.bonus !== undefined ? vals.bonus : Number(record.bonus);
      const proratedOther = record.workingDays > 0
        ? r2((vals.otherAmount / record.workingDays) * record.payableDays)
        : vals.otherAmount;
      const totalEarnings = r10(Number(record.salaryAfterAbsence) + bonus + otAmount + proratedOther);
      const totalDeductions = r2(Number(record.pf) + Number(record.esi) + Number(record.pt) + Number(record.advance) + vals.canteenCharges);
      const netSalary = r10(totalEarnings - totalDeductions);
      const cheque = r2(Math.min(Math.max(Number(record.chequeAmount), 0), Math.max(netSalary, 0)));
      patchRecord({ ...(vals.bonus !== undefined ? { bonus: String(bonus) } : {}), otDays: String(vals.otDays), otAmount: String(otAmount), otherAmount: String(vals.otherAmount), canteenCharges: String(vals.canteenCharges), totalEarnings: String(totalEarnings), totalDeductions: String(totalDeductions), netSalary: String(netSalary), cashAmount: String(r2(netSalary - cheque)), chequeAmount: String(cheque) });
      return { prev };
    },
    onSuccess: (data) => { setRowError(null); if (data.record) patchRecord(data.record); },
    onError: (e: Error, _v, ctx) => { setRowError(e.message); if (ctx?.prev) queryClient.setQueryData(recordsQueryKey, ctx.prev); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: recordsQueryKey }),
  });

  const mutAdvance = useMutation({
    mutationFn: (amount: number) => post(`/api/payroll/records/${record.id}/advance`, { amount }),
    onMutate: async (amount) => {
      await queryClient.cancelQueries({ queryKey: recordsQueryKey });
      const prev = queryClient.getQueryData(recordsQueryKey);
      const totalDeductions = r2(Number(record.pf) + Number(record.esi) + Number(record.pt) + amount + Number(record.canteenCharges));
      const netSalary = r10(Number(record.totalEarnings) - totalDeductions);
      const cheque = r2(Math.min(Math.max(Number(record.chequeAmount), 0), Math.max(netSalary, 0)));
      patchRecord({ advance: String(amount), totalDeductions: String(totalDeductions), netSalary: String(netSalary), cashAmount: String(r2(netSalary - cheque)), chequeAmount: String(cheque) });
      return { prev };
    },
    onSuccess: (data) => { setRowError(null); if (data.record) patchRecord(data.record); },
    onError: (e: Error, _v, ctx) => { setRowError(e.message); if (ctx?.prev) queryClient.setQueryData(recordsQueryKey, ctx.prev); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: recordsQueryKey }),
  });

  const mutPayment = useMutation({
    mutationFn: (chequeAmount: number) => post(`/api/payroll/records/${record.id}/payment`, { chequeAmount }),
    onMutate: async (chequeAmount) => {
      await queryClient.cancelQueries({ queryKey: recordsQueryKey });
      const prev = queryClient.getQueryData(recordsQueryKey);
      const net = Number(record.netSalary);
      patchRecord({ chequeAmount: String(r2(chequeAmount)), cashAmount: String(r2(net - chequeAmount)) });
      return { prev };
    },
    onSuccess: (data) => { setRowError(null); if (data.record) patchRecord(data.record); },
    onError: (e: Error, _v, ctx) => { setRowError(e.message); if (ctx?.prev) queryClient.setQueryData(recordsQueryKey, ctx.prev); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: recordsQueryKey }),
  });

  const stickyBg = selected ? "!bg-navy-100" : "!bg-white";

  return (
    <tr className={selected ? "bg-navy-100" : undefined}>
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
        <EditableAmount
          value={Number(record.otherAmount)}
          disabled={disabled}
          onCommit={(n) => mutExtras.mutate({ canteenCharges: Number(record.canteenCharges), otDays: Number(record.otDays), otherAmount: n })}
        />
      </td>
      <td>
        <ReadCell value={formatCurrencyINR(Number(record.monthlySalary) + Number(record.otherAmount))} emphasis />
      </td>

      {/* Attendance */}
      <td>
        <ReadCell value={record.workingDays} />
      </td>
      <td>
        <ReadCell value={record.presentDays} />
      </td>
      <td>
        <ReadCell value={record.actualAbsentDays} />
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
        {bonusEnabled ? (
          <EditableAmount
            value={Number(record.bonus)}
            disabled={disabled}
            onCommit={(n) => mutExtras.mutate({ canteenCharges: Number(record.canteenCharges), otDays: Number(record.otDays), otherAmount: Number(record.otherAmount), bonus: n })}
          />
        ) : (
          <ReadCell value={formatCurrencyINR(record.bonus)} />
        )}
      </td>
      <td>
        <EditableAmount
          value={Number(record.otDays)}
          disabled={disabled}
          width="w-14"
          step="0.5"
          onCommit={(n) => mutExtras.mutate({ canteenCharges: Number(record.canteenCharges), otDays: n, otherAmount: Number(record.otherAmount) })}
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
        <ReadCell value={formatCurrencyINR(record.advance)} />
      </td>
      <td>
        <EditableAmount
          value={Number(record.canteenCharges)}
          disabled={disabled}
          onCommit={(n) => mutExtras.mutate({ canteenCharges: n, otDays: Number(record.otDays), otherAmount: Number(record.otherAmount) })}
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
          <Link href={`${linkPrefix}/salary-sheets/${record.id}`} className="btn-ghost px-2 py-1" title="View">
            <EyeIcon />
          </Link>
        </div>
      </td>
    </tr>
  );
}

export default function SalarySheetsPage() {
  const queryClient = useQueryClient();
  const company = useCompany();
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
  const [bonusToggling, setBonusToggling] = useState(false);
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
  const recordsQueryKey = ["payroll-records", periodId, company.code, debouncedSearch];

  const { data: recordsData, isLoading: recordsLoading, refetch } = useQuery({
    queryKey: recordsQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ periodId: periodId!, company: company.code });
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
      const res = await fetch(`/api/payroll/periods/${periodId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: company.code }),
      });
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

  const bonusEnabled = periodData?.bonusEnabled ?? false;

  async function handleBonusToggle(checked: boolean) {
    if (!periodId) return;
    setBonusToggling(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/payroll/periods/${periodId}/bonus-toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked, company: company.code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Unable to toggle bonus");
        return;
      }
      refreshAll();
    } finally {
      setBonusToggling(false);
    }
  }

  const records: PayrollRecordRow[] = recordsData?.records || [];
  const isFinalized = periodData?.status === "FINALIZED";
  const allEmployeeIds = records.map((r) => r.employee.id);
  const allSelected = allEmployeeIds.length > 0 && allEmployeeIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;
  const employeeIdsQuery = someSelected ? `&employeeIds=${Array.from(selectedIds).join(",")}` : "";
  const companyQuery = `&company=${company.code}`;

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
    <div className="flex flex-col h-full gap-4">
      <div className="shrink-0 flex items-center justify-between flex-wrap gap-3">
        <PeriodPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
        <div className="flex items-center gap-2">
          {periodData && <StatusBadge status={periodData.status} />}
          <button className="btn-secondary" onClick={() => refetch()}>
            Refresh
          </button>
          {periodId && (
            <a
              href={`/api/export/payroll/excel?periodId=${periodId}${companyQuery}${employeeIdsQuery}`}
              className="btn-secondary"
              download
            >
              <DownloadIcon /> Export Excel{someSelected ? ` (${selectedIds.size})` : ""}
            </a>
          )}
          {periodId && (
            <Link
              href={`/print/salary-sheet?periodId=${periodId}${companyQuery}${employeeIdsQuery}`}
              className="btn-secondary"
              target="_blank"
            >
              <PrintIcon /> Print Salary Sheet{someSelected ? ` (${selectedIds.size})` : ""}
            </Link>
          )}
        </div>
      </div>

      {someSelected && (
        <div className="shrink-0 flex items-center justify-between rounded-md bg-navy-50 text-navy-700 text-xs px-3 py-2">
          <span>
            {selectedIds.size} of {records.length} employee(s) selected — Print and Export will only include the
            selected employees.
          </span>
          <button className="text-navy-500 hover:text-navy-800 font-medium" onClick={() => setSelectedIds(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      <div className="shrink-0">
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
      </div>

      {actionError && <div className="shrink-0 rounded-md bg-danger-50 text-danger-700 text-sm px-3 py-2">{actionError}</div>}

      {periodId && records.length > 0 && (
        <div className="shrink-0 flex items-center gap-3 rounded-md bg-navy-50 text-navy-700 text-xs px-3 py-2">
          <label className="flex items-center gap-2 font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={bonusEnabled}
              disabled={isFinalized || bonusToggling}
              onChange={(e) => handleBonusToggle(e.target.checked)}
            />
            {bonusToggling ? "Updating..." : "Enable Full Attendance Bonus"}
          </label>
          <span className="text-navy-400">
            {bonusEnabled
              ? "Bonus is active — eligible employees receive the bonus. Amount is editable per employee."
              : "Bonus is off for this month. Check to enable."}
          </span>
        </div>
      )}

      {isFinalized && (
        <div className="shrink-0 rounded-md bg-navy-50 text-navy-600 text-xs px-3 py-2">
          This payroll is finalized, so the sheet below is read-only. Click <strong>Reopen Payroll</strong> to edit
          any figure again.
        </div>
      )}
      {!isFinalized && (
        <div className="shrink-0 rounded-md bg-navy-50 text-navy-600 text-xs px-3 py-2">
          Other Salary, OT Days, Canteen Charges and Cheque Amount are editable directly in the cell below —
          click in, type, and tab or click away to save. Attendance is managed from the Attendance page. Basic Salary,
          HRA and Conveyance are edited from the Employees page. Statutory figures (PF, ESI, PT) and totals are
          calculated automatically.
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
        <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-navy-100">
          <table className="table-base !border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-[10] w-10 min-w-[40px] max-w-[40px] !bg-white" rowSpan={2}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => toggleSelectAll(allEmployeeIds)}
                    aria-label="Select all employees"
                  />
                </th>
                <th className="sticky top-0 left-10 z-[10] w-14 min-w-[56px] max-w-[56px] !bg-white" rowSpan={2}>
                  S.No
                </th>
                <th
                  className="sticky top-0 left-[96px] z-[10] w-[220px] min-w-[220px] max-w-[220px] !bg-white border-r border-navy-200"
                  rowSpan={2}
                >
                  Employee Name
                </th>
                <th colSpan={5} className="sticky top-0 z-[8] text-center border-l border-navy-200 !bg-white">
                  Rate of Pay
                </th>
                <th colSpan={7} className="sticky top-0 z-[8] text-center border-l border-navy-200 !bg-white">
                  Attendance
                </th>
                <th colSpan={5} className="sticky top-0 z-[8] text-center border-l border-navy-200 !bg-white">
                  Earned Salary
                </th>
                <th colSpan={7} className="sticky top-0 z-[8] text-center border-l border-navy-200 !bg-white">
                  Deductions
                </th>
                <th rowSpan={2} className="sticky top-0 z-[8] border-l border-navy-200 !bg-white">
                  Net Salary
                </th>
                <th colSpan={2} className="sticky top-0 z-[8] text-center border-l border-navy-200 !bg-white">
                  Payment
                </th>
                <th className="sticky top-0 z-[8] text-right !bg-white" rowSpan={2}>
                  Action
                </th>
              </tr>
              <tr>
                <th className="sticky top-[33px] z-[8] border-l border-navy-200 !bg-white">Basic Salary</th>
                <th className="sticky top-[33px] z-[8] !bg-white">HRA</th>
                <th className="sticky top-[33px] z-[8] !bg-white">Conveyance</th>
                <th className="sticky top-[33px] z-[8] !bg-white">Other Salary</th>
                <th className="sticky top-[33px] z-[8] !bg-white">Total</th>
                <th className="sticky top-[33px] z-[8] border-l border-navy-200 !bg-white">Working Days</th>
                <th className="sticky top-[33px] z-[8] !bg-white">Present Days</th>
                <th className="sticky top-[33px] z-[8] !bg-white">Actual Absent</th>
                <th className="sticky top-[33px] z-[8] !bg-white">Paid Leave</th>
                <th className="sticky top-[33px] z-[8] !bg-white">Paid Leave Used</th>
                <th className="sticky top-[33px] z-[8] !bg-white">Deductible Absent</th>
                <th className="sticky top-[33px] z-[8] !bg-white">Payable Days</th>
                <th className="sticky top-[33px] z-[8] border-l border-navy-200 !bg-white">Salary After Absence</th>
                <th className="sticky top-[33px] z-[8] !bg-white">Bonus</th>
                <th className="sticky top-[33px] z-[8] !bg-white">OT Days</th>
                <th className="sticky top-[33px] z-[8] !bg-white">OT Amount</th>
                <th className="sticky top-[33px] z-[8] !bg-white">Total Earnings</th>
                <th className="sticky top-[33px] z-[8] border-l border-navy-200 !bg-white">PF</th>
                <th className="sticky top-[33px] z-[8] !bg-white">ESI</th>
                <th className="sticky top-[33px] z-[8] !bg-white">PT</th>
                <th className="sticky top-[33px] z-[8] !bg-white">Advance</th>
                <th className="sticky top-[33px] z-[8] !bg-white">Canteen</th>
                <th className="sticky top-[33px] z-[8] !bg-white">Total</th>
                <th className="sticky top-[33px] z-[8] border-l border-navy-200 !bg-white">Net Cash</th>
                <th className="sticky top-[33px] z-[8] !bg-white">Cheque Amount</th>
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
                  bonusEnabled={bonusEnabled}
                  onChanged={refreshAll}
                  linkPrefix={company.prefix}
                  recordsQueryKey={recordsQueryKey}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold bg-navy-50/60">
                <td colSpan={7} className="text-right pr-3">
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
