"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FormDrawer } from "@/components/ui/FormDrawer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PlusIcon, EditIcon } from "@/components/icons";
import { formatDate, formatCurrencyINR } from "@/lib/date-utils";

interface BonusRule {
  id: string;
  name: string;
  amount: string;
  enabled: boolean;
  effectiveFrom: string;
}

export default function BonusSettingsPage() {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<BonusRule | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "Full Attendance Bonus", amount: "", enabled: true, effectiveFrom: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["rules", "bonus"],
    queryFn: async () => {
      const res = await fetch("/api/rules/bonus");
      return res.json();
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["rules", "bonus"] });
  }

  function openAdd() {
    setEditing(null);
    setFormError(null);
    setForm({ name: "Full Attendance Bonus", amount: "", enabled: true, effectiveFrom: "" });
    setDrawerOpen(true);
  }

  function openEdit(rule: BonusRule) {
    setEditing(rule);
    setFormError(null);
    setForm({ name: rule.name, amount: rule.amount, enabled: rule.enabled, effectiveFrom: rule.effectiveFrom.slice(0, 10) });
    setDrawerOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const url = editing ? `/api/rules/bonus/${editing.id}` : "/api/rules/bonus";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const resData = await res.json();
      if (!res.ok) {
        setFormError(resData.error || "Unable to save bonus rule");
        return;
      }
      setDrawerOpen(false);
      refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const rules: BonusRule[] = data?.rules || [];

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-navy-500">
          Employees receive this bonus only when present every working day of the month with zero actual absences.
          Using the monthly paid leave still disqualifies the bonus.
        </p>
      </div>
      <div className="flex justify-end">
        <button className="btn-primary" onClick={openAdd}>
          <PlusIcon /> Add Bonus Rule
        </button>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center text-sm text-navy-400">Loading...</div>
      ) : rules.length === 0 ? (
        <div className="card p-8 text-center text-sm text-navy-400">No bonus rule configured. Bonus defaults to disabled.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th>Name</th>
                <th>Amount</th>
                <th>Effective From</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium text-navy-900">{r.name}</td>
                  <td>{formatCurrencyINR(r.amount)}</td>
                  <td>{formatDate(r.effectiveFrom)}</td>
                  <td>
                    <StatusBadge status={r.enabled ? "ACTIVE" : "INACTIVE"} />
                  </td>
                  <td>
                    <div className="flex justify-end">
                      <button className="btn-ghost px-2 py-1" onClick={() => openEdit(r)}>
                        <EditIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FormDrawer open={drawerOpen} title={editing ? "Edit Bonus Rule" : "Add Bonus Rule"} onClose={() => setDrawerOpen(false)} width="max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <div className="rounded-md bg-danger-50 text-danger-700 text-sm px-3 py-2">{formError}</div>}
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Amount</label>
            <input type="text" inputMode="numeric" className="input" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Effective From</label>
            <input type="date" className="input" value={form.effectiveFrom} onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))} required />
          </div>
          <label className="flex items-center gap-2 text-sm text-navy-700">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} /> Enabled
          </label>
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
    </div>
  );
}
