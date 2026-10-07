"use client";

import { useMemo, useState } from "react";

export interface BulkEmployee {
  id: string;
  name: string;
  department: string | null;
  salaryConfig: {
    pfApplicable: boolean;
    esiApplicable: boolean;
    ptApplicable: boolean;
    bonusApplicable: boolean;
    paidLeaveApplicable: boolean;
  } | null;
}

type Field = "pfApplicable" | "esiApplicable" | "ptApplicable" | "bonusApplicable" | "paidLeaveApplicable";

const TABS: { key: Field; label: string }[] = [
  { key: "pfApplicable", label: "PF Applicable" },
  { key: "esiApplicable", label: "ESI Applicable" },
  { key: "ptApplicable", label: "PT Applicable" },
  { key: "bonusApplicable", label: "Attendance Bonus" },
  { key: "paidLeaveApplicable", label: "Paid Leave" },
];

/** Which employees currently have `field` switched on, per the server. */
function storedSelection(employees: BulkEmployee[], field: Field): Set<string> {
  return new Set(employees.filter((e) => e.salaryConfig?.[field]).map((e) => e.id));
}

function sameSet(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/** What the unsaved-changes prompt is blocking. */
type Pending = { kind: "tab"; to: Field } | { kind: "close" } | null;

export function BulkConfigDrawer({
  employees,
  company,
  onClose,
  onSaved,
}: {
  employees: BulkEmployee[];
  company: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [field, setField] = useState<Field>("pfApplicable");
  const [selected, setSelected] = useState<Set<string>>(() => storedSelection(employees, "pfApplicable"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [search, setSearch] = useState("");

  // What the server holds for the active tab. Deliberately not used to reset
  // `selected` in an effect — `employees` gets a new array identity on every
  // refetch, which would wipe a selection the user was still working on.
  // After a save the refetched data matches `selected`, so isDirty clears on
  // its own.
  const baseline = useMemo(() => storedSelection(employees, field), [employees, field]);
  const isDirty = !sameSet(selected, baseline);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => e.name.toLowerCase().includes(q));
  }, [employees, search]);

  function switchTo(next: Field) {
    setField(next);
    setSelected(storedSelection(employees, next));
    setSavedNote(null);
    setError(null);
  }

  function toggle(id: string) {
    setSavedNote(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setAllVisible(on: boolean) {
    setSavedNote(null);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const e of visible) {
        if (on) next.add(e.id);
        else next.delete(e.id);
      }
      return next;
    });
  }

  function requestTab(next: Field) {
    if (next === field) return;
    if (isDirty) setPending({ kind: "tab", to: next });
    else switchTo(next);
  }

  function requestClose() {
    if (isDirty) setPending({ kind: "close" });
    else onClose();
  }

  function discard() {
    const p = pending;
    setPending(null);
    if (!p) return;
    if (p.kind === "close") onClose();
    else switchTo(p.to);
  }

  async function save(after: Pending = null) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/employees/bulk-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field,
          enabledIds: Array.from(selected),
          scopeIds: employees.map((e) => e.id),
          company,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to apply bulk update");
        return;
      }
      setSavedNote(`${TABS.find((t) => t.key === field)?.label}: ${data.enabled} on, ${data.disabled} off.`);
      onSaved();
      setPending(null);
      if (after?.kind === "close") onClose();
      else if (after?.kind === "tab") switchTo(after.to);
    } finally {
      setSaving(false);
    }
  }

  const activeLabel = TABS.find((t) => t.key === field)?.label ?? "";
  const allVisibleOn = visible.length > 0 && visible.every((e) => selected.has(e.id));

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-navy-900/40" onClick={requestClose} />
      <div className="relative bg-white h-full w-full max-w-2xl shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 h-14 border-b border-navy-100 shrink-0">
          <h2 className="text-sm font-semibold text-navy-900">Bulk Edit — Payroll Configuration</h2>
          <button onClick={requestClose} className="text-navy-400 hover:text-navy-700 text-sm">
            Close
          </button>
        </div>

        <div className="shrink-0 flex gap-1 border-b border-navy-100 px-3 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => requestTab(t.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                field === t.key
                  ? "border-navy-800 text-navy-900"
                  : "border-transparent text-navy-400 hover:text-navy-700"
              }`}
            >
              {t.label}
              {field === t.key && isDirty && <span className="ml-1 text-warning-700">•</span>}
            </button>
          ))}
        </div>

        <div className="shrink-0 px-5 pt-4 space-y-3">
          {error && <div className="rounded-md bg-danger-50 text-danger-700 text-sm px-3 py-2">{error}</div>}
          {savedNote && !isDirty && (
            <div className="rounded-md bg-success-50 text-success-700 text-sm px-3 py-2">{savedNote}</div>
          )}
          <p className="text-xs text-navy-500">
            Tick the employees who should have <strong>{activeLabel}</strong> enabled. Unticked employees in this
            list have it turned off when you save.
          </p>
          <div className="flex items-center gap-2">
            <input
              className="input text-sm"
              placeholder="Filter by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn-secondary whitespace-nowrap" onClick={() => setAllVisible(!allVisibleOn)}>
              {allVisibleOn ? "Clear shown" : "Select shown"}
            </button>
          </div>
          <div className="text-xs text-navy-500">
            {selected.size} of {employees.length} selected
            {isDirty && <span className="ml-2 text-warning-700 font-medium">Unsaved changes</span>}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto scroll-thick px-5 py-3">
          <table className="table-base">
            <tbody>
              {visible.map((e) => (
                <tr key={e.id}>
                  <td className="w-10">
                    <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
                  </td>
                  <td className="font-medium text-navy-900">{e.name}</td>
                  <td className="text-navy-400">{e.department || "—"}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-sm text-navy-400 py-6">
                    No employees match that filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 px-5 py-3 border-t border-navy-100">
          <button className="btn-secondary" onClick={requestClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={() => save()} disabled={saving || !isDirty}>
            {saving ? "Saving..." : `Save ${activeLabel}`}
          </button>
        </div>
      </div>

      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4">
          <div className="card w-full max-w-sm p-5">
            <h3 className="text-sm font-semibold text-navy-900">Unsaved changes</h3>
            <p className="text-xs text-navy-500 mt-1">
              You have unsaved changes to <strong>{activeLabel}</strong>
              {pending.kind === "tab" ? " and are moving to another tab" : ""}. Save them, or discard to leave them
              unapplied.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn-secondary" onClick={discard} disabled={saving}>
                Discard
              </button>
              <button className="btn-primary" onClick={() => save(pending)} disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
