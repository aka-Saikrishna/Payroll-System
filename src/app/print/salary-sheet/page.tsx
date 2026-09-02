"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { MONTH_NAMES, formatCurrencyINR } from "@/lib/date-utils";
import { getCompanyByCode } from "@/lib/hooks/useCompany";

export default function PrintSalarySheetPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-navy-500">Loading print preview...</div>}>
      <PrintSalarySheetContent />
    </Suspense>
  );
}

interface PayrollRecordRow {
  id: string;
  status: string;
  updatedAt: string;
  employee: { id: string; employeeCode: string; name: string; department?: string | null; company?: string };
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
  absenceDeduction: string;
  salaryAfterAbsence: string;
  bonus: string;
  otDays: string;
  otAmount: string;
  totalEarnings: string;
  pf: string;
  esi: string;
  pt: string;
  advance: string;
  canteenCharges: string;
  totalDeductions: string;
  netSalary: string;
  cashAmount: string;
  chequeAmount: string;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function PayslipCard({ record, monthLabel }: { record: PayrollRecordRow; monthLabel: string }) {
  const hasOt = Number(record.otAmount) > 0 || Number(record.otDays) > 0;
  const hasCanteen = Number(record.canteenCharges) > 0;
  // Only show the cash/cheque split when part of the salary is actually paid
  // by cheque; otherwise Net Salary alone already says it's fully cash.
  const hasChequePayment = Number(record.chequeAmount) > 0;

  return (
    <div className="payslip-col flex flex-col justify-between p-3.5 bg-white border border-slate-400 rounded-sm text-slate-800 text-[11px]">
      {/* Header */}
      <div>
        <div className="text-center pb-2 border-b border-slate-200">
          <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide leading-tight">
            {getCompanyByCode(record.employee.company || "VPPL").name}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-0.5">{monthLabel}</div>
          <div className="text-[13px] font-bold text-slate-900 uppercase tracking-wide mt-0.5 leading-tight">
            {record.employee.name}
          </div>
        </div>

        {/* Attendance Summary */}
        <div className="py-2 border-b border-slate-200">
          <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
            ATTENDANCE SUMMARY
          </h4>
          <div className="space-y-0.5">
            <div className="flex justify-between text-slate-600">
              <span>Working Days</span>
              <span className="font-medium text-slate-900">{record.workingDays}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Present Days</span>
              <span className="font-medium text-slate-900">{record.presentDays}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Actual Absent Days</span>
              <span className="font-medium text-slate-900">{record.actualAbsentDays}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Paid Leave</span>
              <span className="font-medium text-slate-900">{record.paidLeave}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Paid Leave Used</span>
              <span className="font-medium text-slate-900">{record.paidLeaveUsed}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Deductible Absent Days</span>
              <span className="font-medium text-slate-900">{record.deductibleAbsentDays}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Payable Days</span>
              <span className="font-semibold text-slate-900">{record.payableDays}</span>
            </div>
          </div>
        </div>

        {/* Salary */}
        <div className="py-2 border-b border-slate-200">
          <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
            SALARY
          </h4>
          <div className="space-y-0.5">
            <div className="flex justify-between text-slate-600">
              <span>Total Salary</span>
              <span className="font-medium text-slate-900">{formatCurrencyINR(record.monthlySalary)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Absence Deduction</span>
              <span className="font-medium text-slate-900">{formatCurrencyINR(record.absenceDeduction)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Salary After Absence</span>
              <span className="font-medium text-slate-900">{formatCurrencyINR(record.salaryAfterAbsence)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Full Attendance Bonus</span>
              <span className="font-medium text-slate-900">{formatCurrencyINR(record.bonus)}</span>
            </div>
            {hasOt && (
              <div className="flex justify-between text-slate-600">
                <span>OT / Late Hours</span>
                <span className="font-medium text-slate-900">{formatCurrencyINR(record.otAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Total Earnings</span>
              <span className="font-semibold text-slate-900">{formatCurrencyINR(record.totalEarnings)}</span>
            </div>
          </div>
        </div>

        {/* Deductions */}
        <div className="py-2">
          <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
            DEDUCTIONS
          </h4>
          <div className="space-y-0.5">
            <div className="flex justify-between text-slate-600">
              <span>ESI</span>
              <span className="font-medium text-slate-900">{formatCurrencyINR(record.esi)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>PF</span>
              <span className="font-medium text-slate-900">{formatCurrencyINR(record.pf)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>PT</span>
              <span className="font-medium text-slate-900">{formatCurrencyINR(record.pt)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Advance</span>
              <span className="font-medium text-slate-900">{formatCurrencyINR(record.advance)}</span>
            </div>
            {hasCanteen && (
              <div className="flex justify-between text-slate-600">
                <span>Canteen Charges</span>
                <span className="font-medium text-slate-900">{formatCurrencyINR(record.canteenCharges)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Total Deductions</span>
              <span className="font-semibold text-slate-900">{formatCurrencyINR(record.totalDeductions)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Net Salary at Bottom */}
      <div className="mt-auto">
        <div className="border-t-2 border-slate-900 pt-2 flex justify-between items-center">
          <span className="font-bold text-[11px] uppercase tracking-wide text-slate-900">NET SALARY</span>
          <span className="font-extrabold text-[13px] text-slate-900">{formatCurrencyINR(record.netSalary)}</span>
        </div>

        {hasChequePayment && (
          <div className="pt-1.5">
            <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1 pb-0.5 border-b border-slate-200">
              PAYMENT
            </h4>
            <div className="space-y-0.5">
              <div className="flex justify-between text-slate-600">
                <span>Net Cash</span>
                <span className="font-medium text-slate-900">{formatCurrencyINR(record.cashAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Cheque Amount</span>
                <span className="font-medium text-slate-900">{formatCurrencyINR(record.chequeAmount)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PrintSalarySheetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const periodId = searchParams.get("periodId");
  const employeeIds = searchParams.get("employeeIds");
  const company = searchParams.get("company") || "VPPL";

  const { data: periodData, isLoading: periodLoading } = useQuery({
    queryKey: ["print-period", periodId],
    queryFn: async () => {
      const res = await fetch(`/api/payroll/periods/${periodId}`);
      return res.json();
    },
    enabled: !!periodId,
  });

  const { data: recordsData, isLoading } = useQuery({
    queryKey: ["print-records", periodId, company, employeeIds],
    queryFn: async () => {
      const params = new URLSearchParams({ periodId: periodId!, company });
      if (employeeIds) params.set("employeeIds", employeeIds);
      const res = await fetch(`/api/payroll/records?${params}`);
      return res.json();
    },
    enabled: !!periodId,
  });

  const handleBack = () => {
    if (typeof window === "undefined") return;

    // This page is normally opened in a new tab. history.length is unreliable
    // here (the new tab can inherit unrelated entries), so never use
    // router.back() — it would walk back to something that isn't the salary
    // sheet. Try to close the tab only when it was genuinely script-opened,
    // and always fall back to navigating to the salary sheet, since browsers
    // silently block close() for tabs the script didn't open.
    if (window.opener) {
      window.close();
    }
    router.push("/salary-sheets");
  };

  if (!periodId) return <div className="p-8 text-sm text-navy-500">No payroll period selected.</div>;
  if (isLoading || periodLoading || !periodData) {
    return <div className="p-8 text-sm text-navy-500">Loading print preview...</div>;
  }
  if (!periodData.period) {
    return (
      <div className="p-8 text-sm text-danger-700">
        {periodData.error || "Payroll period not found."} Go back and reopen Print Salary Sheet from the salary sheet
        page.
      </div>
    );
  }

  const period = periodData.period;
  const records: PayrollRecordRow[] = recordsData?.records || [];
  const monthLabel = `${MONTH_NAMES[period.month - 1]} ${period.year}`;
  const headerMonthLabel = `${MONTH_NAMES[period.month - 1].toUpperCase()} ${period.year}`;

  // 4 employees per landscape sheet
  const pages = chunkArray(records, 3);

  return (
    <div className="min-h-screen bg-slate-100 pb-12">
      {/* Top action bar (hidden during print) */}
      <div className="no-print sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <button className="btn-secondary" onClick={handleBack} type="button">
          ← Back
        </button>
        <div className="text-sm font-semibold text-slate-800">
          {headerMonthLabel} · {records.length} employee(s) · {pages.length} sheet(s)
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => window.print()} type="button">
            Print
          </button>
          <button className="btn-secondary" onClick={() => window.print()} type="button">
            Export PDF
          </button>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="p-12 text-center text-sm text-slate-500">No payroll records found for this period.</div>
      ) : (
        <div className="payslip-container py-6 px-4 space-y-8 max-w-[1240px] mx-auto">
          {pages.map((pageRecords, pageIndex) => {
            // Fill empty slots up to 4 so columns stay exactly 25% width
            const emptySlots = 3 - pageRecords.length;

            return (
              <div key={pageIndex} className="payslip-sheet-wrapper">
                <div className="no-print flex justify-between items-center text-xs text-slate-500 mb-1.5 px-1 font-medium">
                  <span>Sheet {pageIndex + 1} of {pages.length}</span>
                  <span>3 members per landscape page</span>
                </div>

                <div className="payslip-sheet bg-white rounded-sm shadow-md grid grid-cols-3 gap-3 p-2.5 min-h-[580px]">
                  {pageRecords.map((record) => (
                    <PayslipCard key={record.id} record={record} monthLabel={monthLabel} />
                  ))}

                  {emptySlots > 0 &&
                    Array.from({ length: emptySlots }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="payslip-col-empty" />
                    ))}
                </div>

              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @page {
          size: A4 landscape;
          margin: 12mm 15mm;
        }

        @media screen {
          .payslip-sheet {
            width: 100%;
            max-width: 1180px;
            margin: 0 auto;
            min-height: 600px;
          }
        }

        @media print {
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .payslip-container {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          .payslip-sheet-wrapper {
            margin: 0 !important;
            padding: 0 !important;
            page-break-after: always;
            break-after: page;
          }
          .payslip-sheet-wrapper:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .payslip-sheet {
            width: 100% !important;
            height: 174mm !important;
            min-height: 174mm !important;
            max-height: 174mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 3mm !important;
            box-sizing: border-box !important;
          }
          .payslip-col {
            border: 0.5px solid #94a3b8 !important;
            border-radius: 1px !important;
            padding: 2mm 3mm !important;
            height: 100% !important;
            box-sizing: border-box !important;
            font-size: 17px !important;
            line-height: 1.45 !important;
          }
          .payslip-col h4 {
            font-size: 16px !important;
            margin-bottom: 2px !important;
          }
          .payslip-col .border-b {
            padding-top: 3px !important;
            padding-bottom: 3px !important;
          }
          .payslip-col .text-\\[10px\\] { font-size: 16px !important; }
          .payslip-col .text-\\[11px\\] { font-size: 17px !important; }
          .payslip-col .text-\\[13px\\] { font-size: 20px !important; }
          .payslip-col-empty {
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
}
