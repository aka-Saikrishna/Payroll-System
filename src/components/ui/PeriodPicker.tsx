"use client";

import { MONTH_NAMES } from "@/lib/date-utils";

export function PeriodPicker({
  year,
  month,
  onChange,
}: {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 3 + i);

  return (
    <div className="flex items-center gap-2">
      <select className="input w-auto" value={month} onChange={(e) => onChange(year, parseInt(e.target.value, 10))}>
        {MONTH_NAMES.map((name, idx) => (
          <option key={name} value={idx + 1}>
            {name}
          </option>
        ))}
      </select>
      <select className="input w-auto" value={year} onChange={(e) => onChange(parseInt(e.target.value, 10), month)}>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
