"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function CompanySettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    companyName: "",
    address: "",
    logoUrl: "",
    managerName: "",
    statutoryRef: "",
    weeklyOffDays: [0] as number[],
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const res = await fetch("/api/company-settings");
      return res.json();
    },
  });

  useEffect(() => {
    if (data?.settings) {
      setForm({
        companyName: data.settings.companyName,
        address: data.settings.address || "",
        logoUrl: data.settings.logoUrl || "",
        managerName: data.settings.managerName || "",
        statutoryRef: data.settings.statutoryRef || "",
        weeklyOffDays: data.settings.weeklyOffDays || [0],
      });
    }
  }, [data]);

  function toggleDay(day: number) {
    setForm((f) => ({
      ...f,
      weeklyOffDays: f.weeklyOffDays.includes(day) ? f.weeklyOffDays.filter((d) => d !== day) : [...f.weeklyOffDays, day],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/company-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const resData = await res.json();
      if (!res.ok) {
        setError(resData.error || "Unable to save settings");
        return;
      }
      setMessage("Company settings saved.");
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg">
      <form onSubmit={handleSubmit} className="card p-5 space-y-4">
        {error && <div className="rounded-md bg-danger-50 text-danger-700 text-sm px-3 py-2">{error}</div>}
        {message && <div className="rounded-md bg-success-50 text-success-700 text-sm px-3 py-2">{message}</div>}

        <div>
          <label className="label">Company Name</label>
          <input className="input" value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Address</label>
          <textarea className="input" rows={2} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </div>
        <div>
          <label className="label">Logo URL</label>
          <input className="input" value={form.logoUrl} onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))} />
        </div>
        <div>
          <label className="label">Manager / Person Responsible for Payment</label>
          <input
            className="input"
            value={form.managerName}
            onChange={(e) => setForm((f) => ({ ...f, managerName: e.target.value }))}
            placeholder="e.g. Rajesh Kumar"
          />
        </div>
        <div>
          <label className="label">Statutory Reference (shown on the printed register)</label>
          <input
            className="input"
            value={form.statutoryRef}
            onChange={(e) => setForm((f) => ({ ...f, statutoryRef: e.target.value }))}
            placeholder="e.g. Vide rule 6 A of A.P. PAYMENT OF Wages Rules, 1937"
          />
        </div>
        <div>
          <label className="label">Weekly Off Days</label>
          <div className="grid grid-cols-2 gap-2">
            {DAYS.map((day, idx) => (
              <label key={day} className="flex items-center gap-2 text-sm text-navy-700">
                <input type="checkbox" checked={form.weeklyOffDays.includes(idx)} onChange={() => toggleDay(idx)} /> {day}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-navy-100">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
