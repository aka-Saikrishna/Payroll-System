"use client";

import clsx from "clsx";
import { MONTH_NAMES } from "@/lib/date-utils";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

export function MonthButtonBar({
  year,
  month,
  onChange,
  currentYear,
  currentMonth,
}: {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
  currentYear: number;
  currentMonth: number;
}) {
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between mb-2">
        <button className="btn-ghost px-2 py-1" onClick={() => onChange(year - 1, month)} aria-label="Previous year">
          <ChevronLeftIcon />
        </button>
        <span className="text-sm font-semibold text-navy-900">{year}</span>
        <button className="btn-ghost px-2 py-1" onClick={() => onChange(year + 1, month)} aria-label="Next year">
          <ChevronRightIcon />
        </button>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
        {MONTH_NAMES.map((name, idx) => {
          const m = idx + 1;
          const isSelected = m === month;
          const isCurrent = year === currentYear && m === currentMonth;
          return (
            <button
              key={name}
              onClick={() => onChange(year, m)}
              className={clsx(
                "relative rounded-md px-2 py-1.5 text-xs font-medium border transition-colors",
                isSelected
                  ? "bg-navy-800 text-white border-navy-800"
                  : "bg-white text-navy-600 border-navy-200 hover:bg-navy-50"
              )}
              title={isCurrent ? `${name} ${year} (current month)` : `${name} ${year}`}
            >
              {name.slice(0, 3)}
              {isCurrent && (
                <span
                  className={clsx(
                    "absolute -top-1 -right-1 w-2 h-2 rounded-full",
                    isSelected ? "bg-white" : "bg-success-500"
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
