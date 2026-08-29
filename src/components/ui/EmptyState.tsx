export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card p-10 flex flex-col items-center justify-center text-center gap-3">
      <div className="text-sm font-medium text-navy-700">{title}</div>
      {description && <div className="text-xs text-navy-400 max-w-sm">{description}</div>}
      {action && <div className="flex gap-2 mt-1">{action}</div>}
    </div>
  );
}
