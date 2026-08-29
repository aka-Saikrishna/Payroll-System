import clsx from "clsx";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-success-50 text-success-700",
  INACTIVE: "bg-navy-100 text-navy-500",
  DRAFT: "bg-navy-100 text-navy-600",
  REVIEW: "bg-warning-50 text-warning-700",
  FINALIZED: "bg-success-50 text-success-700",
  PRESENT: "bg-success-50 text-success-700",
  ABSENT: "bg-danger-50 text-danger-700",
  WEEKLY_OFF: "bg-navy-100 text-navy-500",
  HOLIDAY: "bg-navy-100 text-navy-500",
  PENDING: "bg-warning-50 text-warning-700",
  COMPLETED: "bg-success-50 text-success-700",
  FAILED: "bg-danger-50 text-danger-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={clsx("badge", STATUS_STYLES[status] || "bg-navy-100 text-navy-600")}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
