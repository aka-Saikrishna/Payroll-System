"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FormDrawer } from "@/components/ui/FormDrawer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PlusIcon, EditIcon, TrashIcon } from "@/components/icons";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<UserRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "VIEWER", status: "ACTIVE", password: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      return res.json();
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["users"] });
  }

  function openAdd() {
    setEditing(null);
    setFormError(null);
    setForm({ name: "", email: "", role: "VIEWER", status: "ACTIVE", password: "" });
    setDrawerOpen(true);
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setFormError(null);
    setForm({ name: u.name, email: u.email, role: u.role, status: u.status, password: "" });
    setDrawerOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const url = editing ? `/api/users/${editing.id}` : "/api/users";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const resData = await res.json();
      if (!res.ok) {
        setFormError(resData.error || "Unable to save user");
        return;
      }
      setDrawerOpen(false);
      refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    setSubmitting(true);
    try {
      await fetch(`/api/users/${deactivateTarget.id}`, { method: "DELETE" });
      setDeactivateTarget(null);
      refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const users: UserRow[] = data?.users || [];

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={openAdd}>
          <PlusIcon /> Add User
        </button>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center text-sm text-navy-400">Loading users...</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium text-navy-900">{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role.replace("_", " ")}</td>
                  <td>
                    <StatusBadge status={u.status} />
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost px-2 py-1" onClick={() => openEdit(u)}>
                        <EditIcon />
                      </button>
                      {u.status === "ACTIVE" && (
                        <button className="btn-ghost px-2 py-1" onClick={() => setDeactivateTarget(u)}>
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FormDrawer open={drawerOpen} title={editing ? "Edit User" : "Add User"} onClose={() => setDrawerOpen(false)} width="max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <div className="rounded-md bg-danger-50 text-danger-700 text-sm px-3 py-2">{formError}</div>}
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              <option value="ADMIN">Admin</option>
              <option value="PAYROLL_MANAGER">Payroll Manager</option>
              <option value="VIEWER">Viewer</option>
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <div>
            <label className="label">{editing ? "New Password (leave blank to keep unchanged)" : "Password"}</label>
            <input type="password" className="input" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
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
        open={!!deactivateTarget}
        title="Deactivate user?"
        description={`${deactivateTarget?.name} will no longer be able to sign in.`}
        destructive
        confirmLabel="Deactivate"
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateTarget(null)}
        busy={submitting}
      />
    </div>
  );
}
