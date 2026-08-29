"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Toolbar } from "@/components/ui/Toolbar";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormDrawer } from "@/components/ui/FormDrawer";
import { ImportPanel } from "@/components/excel/ImportPanel";
import { PlusIcon, EditIcon, TrashIcon } from "@/components/icons";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { formatDate, toDateInputValue } from "@/lib/date-utils";

interface HolidayRow {
  id: string;
  date: string;
  name: string;
  type: string;
  status: string;
}

export default function HolidayCalendarPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<HolidayRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HolidayRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ date: "", name: "", type: "PUBLIC_HOLIDAY", status: "ACTIVE" });

  const { data, isLoading } = useQuery({
    queryKey: ["holidays", debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/holidays?${params}`);
      return res.json();
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["holidays"] });
  }

  function openAdd() {
    setEditing(null);
    setForm({ date: "", name: "", type: "PUBLIC_HOLIDAY", status: "ACTIVE" });
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEdit(row: HolidayRow) {
    setEditing(row);
    setForm({ date: toDateInputValue(row.date), name: row.name, type: row.type, status: row.status });
    setFormError(null);
    setDrawerOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const url = editing ? `/api/holidays/${editing.id}` : "/api/holidays";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Unable to save holiday");
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
      await fetch(`/api/holidays/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const holidays: HolidayRow[] = data?.holidays || [];

  return (
    <div className="space-y-4 max-w-3xl">
      <Toolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search holidays...">
        <ImportPanel
          title="Import Holidays"
          fileName="holidays.xlsx"
          previewUrl="/api/import/holidays"
          confirmUrl="/api/import/holidays"
          templateUrl="/api/import/holidays/template"
          onImported={refresh}
        />
        <button className="btn-primary" onClick={openAdd}>
          <PlusIcon /> Add Holiday
        </button>
      </Toolbar>

      {isLoading ? (
        <div className="card p-8 text-center text-sm text-navy-400">Loading holidays...</div>
      ) : holidays.length === 0 ? (
        <EmptyState title="No holidays configured." description="Add a holiday or import from Excel." />
      ) : (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th>Date</th>
                <th>Holiday Name</th>
                <th>Holiday Type</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((h) => (
                <tr key={h.id}>
                  <td>{formatDate(h.date)}</td>
                  <td className="font-medium text-navy-900">{h.name}</td>
                  <td>{h.type.replace(/_/g, " ")}</td>
                  <td>
                    <StatusBadge status={h.status} />
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost px-2 py-1" onClick={() => openEdit(h)}>
                        <EditIcon />
                      </button>
                      <button className="btn-ghost px-2 py-1" onClick={() => setDeleteTarget(h)}>
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FormDrawer open={drawerOpen} title={editing ? "Edit Holiday" : "Add Holiday"} onClose={() => setDrawerOpen(false)} width="max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <div className="rounded-md bg-danger-50 text-danger-700 text-sm px-3 py-2">{formError}</div>}
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Holiday Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Holiday Type</label>
            <select className="input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              <option value="PUBLIC_HOLIDAY">Public Holiday</option>
              <option value="COMPANY_HOLIDAY">Company Holiday</option>
              <option value="OPTIONAL_HOLIDAY">Optional Holiday</option>
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
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
        title="Delete holiday?"
        description="This may change working-day calculations for affected months."
        destructive
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={submitting}
      />
    </div>
  );
}
