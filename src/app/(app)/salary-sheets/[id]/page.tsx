"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MONTH_NAMES, formatCurrencyINR } from "@/lib/date-utils";

function Row({ label, value, emphasis }: { label: string; value: React.ReactNode; emphasis?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${emphasis ? "font-semibold text-navy-900" : "text-navy-700"}`}>
      <span className="text-sm">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

export default function SalarySheetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["payroll-record", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/payroll/records/${params.id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const r = data?.record;

  const [isSplit, setIsSplit] = useState(false);
  const [chequeInput, setChequeInput] = useState("0");
  const [saving, setSaving] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [canteenInput, setCanteenInput] = useState("0");
  const [otDaysInput, setOtDaysInput] = useState("0");
  const [otherAmountInput, setOtherAmountInput] = useState("0");
  const [savingExtras, setSavingExtras] = useState(false);
  const [extrasError, setExtrasError] = useState<string | null>(null);

  useEffect(() => {
    if (r) {
      setChequeInput(String(r.chequeAmount));
      setIsSplit(Number(r.chequeAmount) > 0);
      setCanteenInput(String(r.canteenCharges));
      setOtDaysInput(String(r.otDays));
      setOtherAmountInput(String(r.otherAmount));
    }
  }, [r?.chequeAmount, r?.canteenCharges, r?.otDays, r?.otherAmount, r]);

  if (isLoading) return <div className="text-sm text-navy-400">Loading...</div>;
  if (!r) return <div className="text-sm text-navy-400">Payroll record not found.</div>;

  const totalDeductions =
    Number(r.esi) + Number(r.pf) + Number(r.pt) + Number(r.advance) + Number(r.canteenCharges);
  const netSalary = Number(r.netSalary);
  const chequeAmount = isSplit ? Number(chequeInput) || 0 : 0;
  const netCash = Math.max(Math.round((netSalary - chequeAmount + Number.EPSILON) * 100) / 100, 0);
  const isFinalized = r.status === "FINALIZED";
  const isDirty = chequeAmount !== Number(r.chequeAmount);

  const canteenCharges = Number(canteenInput) || 0;
  const otDays = Number(otDaysInput) || 0;
  const otherAmount = Number(otherAmountInput) || 0;
  const otAmountPreview = (() => {
    const raw = otDays * Number(r.dailyRate);
    const remainder = ((Math.round(raw) % 10) + 10) % 10;
    return remainder < 5 ? Math.round(raw) - remainder : Math.round(raw) + (10 - remainder);
  })();
  const proratedOther = r.workingDays > 0
    ? Math.round((otherAmount / r.workingDays) * r.payableDays * 100) / 100
    : otherAmount;
  const displayTotalSalary = Number(r.monthlySalary) + otherAmount;
  const displayAbsenceDeduction = Number(r.absenceDeduction) + (otherAmount - proratedOther);
  const displaySalaryAfterAbsence = Number(r.salaryAfterAbsence) + proratedOther;
  const isExtrasDirty = canteenCharges !== Number(r.canteenCharges) || otDays !== Number(r.otDays) || otherAmount !== Number(r.otherAmount);

  function handleToggleSplit(checked: boolean) {
    setIsSplit(checked);
    if (!checked) setChequeInput("0");
  }

  async function handleSavePayment() {
    setSaving(true);
    setPaymentError(null);
    try {
      const res = await fetch(`/api/payroll/records/${params.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chequeAmount }),
      });
      const resData = await res.json();
      if (!res.ok) {
        setPaymentError(resData.error || "Unable to save payment split");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["payroll-record", params.id] });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveExtras() {
    setSavingExtras(true);
    setExtrasError(null);
    try {
      const res = await fetch(`/api/payroll/records/${params.id}/extras`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canteenCharges, otDays, otherAmount }),
      });
      const resData = await res.json();
      if (!res.ok) {
        setExtrasError(resData.error || "Unable to save Canteen Charges / OT Days");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["payroll-record", params.id] });
    } finally {
      setSavingExtras(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <button className="text-xs text-navy-500 hover:text-navy-800" onClick={() => router.back()}>
        ← Back
      </button>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-lg font-semibold text-navy-900">{r.employee.name}</h2>
            <p className="text-xs text-navy-500">
              {MONTH_NAMES[r.payrollPeriod.month - 1]} {r.payrollPeriod.year}
            </p>
          </div>
          <StatusBadge status={r.status} />
        </div>

        <div className="grid grid-cols-2 gap-x-8 mt-5">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-navy-500 mb-1">Attendance Summary</h3>
            <Row label="Working Days" value={r.workingDays} />
            <Row label="Present Days" value={r.presentDays} />
            <Row label="Actual Absent Days" value={r.actualAbsentDays} />
            <Row label="Paid Leave" value={r.paidLeave} />
            <Row label="Paid Leave Used" value={r.paidLeaveUsed} />
            <Row label="Deductible Absent Days" value={r.deductibleAbsentDays} />
            <Row label="Payable Days" value={r.payableDays} emphasis />
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-navy-500 mb-1">Salary</h3>
            <Row label="Basic Salary" value={<CurrencyDisplay value={r.basicSalary} />} />
            <Row label="HRA" value={<CurrencyDisplay value={r.hra} />} />
            <Row label="Conveyance" value={<CurrencyDisplay value={r.conveyance} />} />
            <div className="flex items-center justify-between py-1.5 text-navy-700">
              <span className="text-sm">Other Salary</span>
              <input
                type="text"
                inputMode="numeric"
                className="input py-0.5 px-1.5 text-sm text-right w-28"
                value={otherAmountInput}
                disabled={isFinalized}
                onChange={(e) => setOtherAmountInput(e.target.value)}
              />
            </div>
            <Row label="Total Salary" value={<CurrencyDisplay value={displayTotalSalary} />} emphasis />
            <Row label="Absence Deduction" value={<CurrencyDisplay value={displayAbsenceDeduction} />} />
            <Row label="Salary After Absence" value={<CurrencyDisplay value={displaySalaryAfterAbsence} />} />
            <Row label="Full Attendance Bonus" value={<CurrencyDisplay value={r.bonus} />} />
            <Row label="OT / Late Hours Amount" value={<CurrencyDisplay value={r.otAmount} />} />
            <Row label="Total Earnings" value={<CurrencyDisplay value={r.totalEarnings} />} emphasis />
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-navy-100">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-navy-500 mb-1">Deductions</h3>
          <div className="grid grid-cols-2 gap-x-8">
            <div>
              <Row label="ESI" value={<CurrencyDisplay value={r.esi} />} />
              <Row label="PF" value={<CurrencyDisplay value={r.pf} />} />
              <Row label="PT" value={<CurrencyDisplay value={r.pt} />} />
            </div>
            <div>
              <Row label="Advance" value={<CurrencyDisplay value={r.advance} />} />
              <Row label="Canteen Charges" value={<CurrencyDisplay value={r.canteenCharges} />} />
            </div>
          </div>
          <Row label="Total Deductions" value={<CurrencyDisplay value={totalDeductions} />} emphasis />
        </div>

        <div className="mt-5 pt-4 border-t-2 border-navy-800 flex items-center justify-between">
          <span className="text-base font-semibold text-navy-900">NET SALARY</span>
          <CurrencyDisplay value={r.netSalary} className="text-xl font-bold text-navy-900" />
        </div>

        <div className="mt-5 pt-4 border-t border-navy-100">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-navy-500 mb-2">Canteen Charges & OT / Late Hours</h3>
          {extrasError && <div className="rounded-md bg-danger-50 text-danger-700 text-sm px-3 py-2 mb-3">{extrasError}</div>}
          <div className="grid grid-cols-2 gap-x-6">
            <div>
              <label className="label">Canteen Charges</label>
              <input
                type="text"
                inputMode="numeric"
                className="input"
                value={canteenInput}
                disabled={isFinalized}
                onChange={(e) => setCanteenInput(e.target.value)}
              />
            </div>
            <div>
              <label className="label">OT Days</label>
              <input
                type="text"
                inputMode="numeric"
                className="input"
                value={otDaysInput}
                disabled={isFinalized}
                onChange={(e) => setOtDaysInput(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-navy-500 mt-2">
            Daily rate: {formatCurrencyINR(r.dailyRate)} · OT Amount ({otDays} × {formatCurrencyINR(r.dailyRate)}, rounded
            to the nearest ₹10): <span className="font-semibold text-navy-700">{formatCurrencyINR(otAmountPreview)}</span>
          </p>
          {isFinalized ? (
            <p className="text-xs text-navy-400 mt-2">Payroll is finalized — reopen it to edit extras.</p>
          ) : (
            <div className="flex justify-end mt-3">
              <button className="btn-primary" onClick={handleSaveExtras} disabled={savingExtras || !isExtrasDirty}>
                {savingExtras ? "Saving..." : "Save Extras"}
              </button>
            </div>
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-navy-100">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-navy-500 mb-2">Payment Split</h3>
          {paymentError && <div className="rounded-md bg-danger-50 text-danger-700 text-sm px-3 py-2 mb-3">{paymentError}</div>}

          <label className="flex items-center gap-2 text-sm text-navy-700 mb-3">
            <input
              type="checkbox"
              checked={isSplit}
              disabled={isFinalized}
              onChange={(e) => handleToggleSplit(e.target.checked)}
            />
            Pay part of this salary by cheque
          </label>

          {!isSplit ? (
            <p className="text-xs text-navy-500 mb-1">
              Entire Net Salary ({formatCurrencyINR(netSalary)}) will be paid in cash.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-x-8 items-end">
              <div>
                <label className="label">Cheque Amount</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="input"
                  value={chequeInput}
                  disabled={isFinalized}
                  onChange={(e) => setChequeInput(e.target.value)}
                />
              </div>
              <div>
                <div className="text-xs font-medium text-navy-600 mb-1">Net Cash (auto-calculated)</div>
                <div className="input bg-navy-50 text-navy-700 flex items-center">{formatCurrencyINR(netCash)}</div>
              </div>
            </div>
          )}
          {isFinalized ? (
            <p className="text-xs text-navy-400 mt-2">Payroll is finalized — reopen it to edit the payment split.</p>
          ) : (
            <div className="flex justify-end mt-3">
              <button className="btn-primary" onClick={handleSavePayment} disabled={saving || !isDirty}>
                {saving ? "Saving..." : "Save Payment Split"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
