export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-1 py-2 text-xs text-navy-500">
      <span>
        Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex gap-1">
        <button className="btn-secondary px-2 py-1" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Prev
        </button>
        <span className="px-2 py-1">
          Page {page} of {totalPages}
        </span>
        <button
          className="btn-secondary px-2 py-1"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
