import { formatCurrencyINR } from "@/lib/date-utils";
import clsx from "clsx";

export function CurrencyDisplay({ value, className, emphasis }: { value: number | string; className?: string; emphasis?: boolean }) {
  return (
    <span className={clsx("tabular-nums", emphasis && "font-semibold text-navy-900", className)}>
      {formatCurrencyINR(value)}
    </span>
  );
}
