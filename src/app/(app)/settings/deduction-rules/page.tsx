"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { FormDrawer } from "@/components/ui/FormDrawer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PlusIcon, EditIcon } from "@/components/icons";
import { formatDate, formatCurrencyINR } from "@/lib/date-utils";

type TabKey = "pf" | "esi" | "pt";

const TABS: { key: TabKey; label: string }[] = [
  { key: "pf", label: "PF" },
  { key: "esi", label: "ESI" },
  { key: "pt", label: "PT" },
];

interface RateRule {
  id: string;
  ratePercent?: string;
  wageCeiling?: string | null;
  amount?: string;
  minSalary?: string;
  maxSalary?: string | null;
  ptAmount?: string;
  enabled: boolean;
  effectiveFrom: string;
}

export default function DeductionRulesPage() {
  const [tab, setTab] = useState<TabKey>("pf");
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<RateRule | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["rules", tab],
    queryFn: async () => {
      const res = await fetch(`/api/rules/${tab}`);
      return res.json();
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["rules", tab] });
  }

  function openAdd() {
    setEditing(null);
    setFormError(null);
    if (tab === "pt") setForm({ minSalary: "", maxSalary: "", ptAmount: "", enabled: true, effectiveFrom: "" });
    else setForm({ ratePercent: "", wageCeiling: "", enabled: true, effectiveFrom: "" });
    setDrawerOpen(true);
  }

  function openEdit(rule: RateRule) {
    setEditing(rule);
    setFormError(null);
    if (tab === "pt") {
      setForm({
        minSalary: rule.minSalary || "",
        maxSalary: rule.maxSalary || "",
        ptAmount: rule.ptAmount || "",
        enabled: rule.enabled,
        effectiveFrom: rule.effectiveFrom.slice(0, 10),
      });
    } else {
      setForm({
        ratePercent: rule.ratePercent || "",
        wageCeiling: rule.wageCeiling || "",
        enabled: rule.enabled,
        effectiveFrom: rule.effectiveFrom.slice(0, 10),
      });
    }
    setDrawerOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const url = editing ? `/api/rules/${tab}/${editing.id}` : `/api/rules/${tab}`;
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const resData = await res.json();
      if (!res.ok) {
        setFormError(resData.error || "Unable to save rule");
        return;
      }
      setDrawerOpen(false);
      refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const rules: RateRule[] = data?.rules || [];

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex gap-1 border-b border-navy-100">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={clsx(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px",
              tab === t.key ? "border-navy-800 text-navy-900" : "border-transparent text-navy-400 hover:text-navy-700"
            )}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <button className="btn-primary" onClick={openAdd}>
          <PlusIcon /> Add {tab.toUpperCase()} Rule
        </button>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center text-sm text-navy-400">Loading rules...</div>
      ) : rules.length === 0 ? (
        <div className="card p-8 text-center text-sm text-navy-400">No {tab.toUpperCase()} rules configured yet.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                {tab === "pt" ? (
                  <>
                    <th>Min Salary</th>
                    <th>Max Salary</th>
                    <th>PT Amount</th>
                  </>
                ) : (
                  <>
                    <th>Rate %</th>
                    <th>Wage Ceiling</th>
                  </>
                )}
                <th>Effective From</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  {tab === "pt" ? (
                    <>
                      <td>{formatCurrencyINR(r.minSalary || 0)}</td>
                      <td>{r.maxSalary ? formatCurrencyINR(r.maxSalary) : "No limit"}</td>
                      <td>{formatCurrencyINR(r.ptAmount || 0)}</td>
                    </>
                  ) : (
                    <>
                      <td>{r.ratePercent}%</td>
                      <td>{r.wageCeiling ? formatCurrencyINR(r.wageCeiling) : "No limit"}</td>
                    </>
                  )}
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

      <FormDrawer open={drawerOpen} title={editing ? `Edit ${tab.toUpperCase()} Rule` : `Add ${tab.toUpperCase()} Rule`} onClose={() => setDrawerOpen(false)} width="max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <div className="rounded-md bg-danger-50 text-danger-700 text-sm px-3 py-2">{formError}</div>}

          {tab === "pt" ? (
            <>
              <div>
                <label className="label">Minimum Salary</label>
                <input type="text" inputMode="numeric" className="input" value={String(form.minSalary ?? "")} onChange={(e) => setForm((f) => ({ ...f, minSalary: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Maximum Salary (blank = no limit)</label>
                <input type="text" inputMode="numeric" className="input" value={String(form.maxSalary ?? "")} onChange={(e) => setForm((f) => ({ ...f, maxSalary: e.target.value }))} />
              </div>
              <div>
                <label className="label">PT Amount</label>
                <input type="text" inputMode="numeric" className="input" value={String(form.ptAmount ?? "")} onChange={(e) => setForm((f) => ({ ...f, ptAmount: e.target.value }))} required />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="label">Rate (%)</label>
                <input type="text" inputMode="numeric" className="input" value={String(form.ratePercent ?? "")} onChange={(e) => setForm((f) => ({ ...f, ratePercent: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Wage Ceiling (blank = no limit)</label>
                <input type="text" inputMode="numeric" className="input" value={String(form.wageCeiling ?? "")} onChange={(e) => setForm((f) => ({ ...f, wageCeiling: e.target.value }))} />
              </div>
            </>
          )}

          <div>
            <label className="label">Effective From</label>
            <input type="date" className="input" value={String(form.effectiveFrom ?? "")} onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))} required />
          </div>
          <label className="flex items-center gap-2 text-sm text-navy-700">
            <input type="checkbox" checked={Boolean(form.enabled)} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} /> Enabled
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
