"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Toolbar } from "@/components/ui/Toolbar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { CurrencyDisplay } from "@/components/ui/CurrencyDisplay";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormDrawer } from "@/components/ui/FormDrawer";
import { ImportPanel } from "@/components/excel/ImportPanel";
import { PlusIcon, EditIcon, TrashIcon } from "@/components/icons";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { formatDate, toDateInputValue } from "@/lib/date-utils";

interface AdvanceRow {
  id: string;
  employee: { id: string; employeeCode: string; name: string };
  advanceDate: string;
  amount: string;
  reference: string | null;
  remarks: string | null;
}

export default function AdvancesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AdvanceRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdvanceRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ employeeId: "", advanceDate: "", amount: "", reference: "", remarks: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["advances", debouncedSearch, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/advances?${params}`);
      return res.json();
    },
  });

  const { data: employeesData } = useQuery({
    queryKey: ["employees-all"],
    queryFn: async () => {
      const res = await fetch("/api/employees?pageSize=200");
      return res.json();
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["advances"] });
  }

  function openAdd() {
    setEditing(null);
    setForm({ employeeId: "", advanceDate: "", amount: "", reference: "", remarks: "" });
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEdit(row: AdvanceRow) {
    setEditing(row);
    setForm({
      employeeId: row.employee.id,
      advanceDate: toDateInputValue(row.advanceDate),
      amount: row.amount,
      reference: row.reference || "",
      remarks: row.remarks || "",
    });
    setFormError(null);
    setDrawerOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const url = editing ? `/api/advances/${editing.id}` : "/api/advances";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Unable to save advance");
        return;
      }
      setDrawerOpen(false);
      refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await fetch(`/api/advances/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const advances: AdvanceRow[] = data?.advances || [];

  return (
    <div className="space-y-4 max-w-5xl">
      <Toolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search by employee name...">
        <ImportPanel
          title="Import Advances"
          fileName="advances.xlsx"
          previewUrl="/api/import/advances"
          confirmUrl="/api/import/advances"
          templateUrl="/api/import/advances/template"
          onImported={refresh}
        />
        <button className="btn-primary" onClick={openAdd}>
          <PlusIcon /> Add Advance
        </button>
      </Toolbar>

      {isLoading ? (
        <div className="card p-8 text-center text-sm text-navy-400">Loading advances...</div>
      ) : advances.length === 0 ? (
        <EmptyState title="No advances found." description="Add an advance or import from Excel." />
      ) : (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Reference</th>
                <th>Remarks</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {advances.map((a) => (
                <tr key={a.id}>
                  <td className="font-medium text-navy-900">
                    {a.employee.name}
                  </td>
                  <td>{formatDate(a.advanceDate)}</td>
                  <td>
                    <CurrencyDisplay value={a.amount} />
                  </td>
                  <td>{a.reference || "—"}</td>
                  <td>{a.remarks || "—"}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost px-2 py-1" onClick={() => openEdit(a)}>
                        <EditIcon />
                      </button>
                      <button className="btn-ghost px-2 py-1" onClick={() => setDeleteTarget(a)}>
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3">
            <Pagination page={page} pageSize={20} total={data?.total || 0} onPageChange={setPage} />
          </div>
        </div>
      )}

      <FormDrawer open={drawerOpen} title={editing ? "Edit Advance" : "Add Advance"} onClose={() => setDrawerOpen(false)} width="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <div className="rounded-md bg-danger-50 text-danger-700 text-sm px-3 py-2">{formError}</div>}
          <div>
            <label className="label">Employee</label>
            <select
              className="input"
              value={form.employeeId}
              onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
              required
            >
              <option value="">Select employee</option>
              {(employeesData?.employees || []).map((e: { id: string; employeeCode: string; name: string }) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              className="input"
              value={form.advanceDate}
              onChange={(e) => setForm((f) => ({ ...f, advanceDate: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">Amount</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">Reference</label>
            <input className="input" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} />
          </div>
          <div>
            <label className="label">Remarks</label>
            <input className="input" value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-navy-100">
            <button type="button" className="btn-secondary" onClick={() => setDrawerOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </FormDrawer>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete advance?"
        description="This cannot be undone."
        destructive
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={submitting}
      />
    </div>
  );
}
