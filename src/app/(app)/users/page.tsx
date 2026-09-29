"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/lib/useRole";
import { Role, AdminUserRow } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export default function UsersPage() {
  const role = useRole();
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("team");
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<{ email: string; temporaryPassword: string } | null>(
    null
  );

  async function load() {
    setError(null);
    const res = await fetch("/api/admin/users");
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Could not load users.");
      return;
    }
    setUsers(body.users);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setJustCreated(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), role: newRole }),
    });
    const body = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(body.error ?? "Could not create the account.");
      return;
    }
    setJustCreated(body);
    setEmail("");
    setNewRole("team");
    load();
  }

  async function handleRoleChange(id: string, role: Role) {
    setError(null);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Could not update role.");
      return;
    }
    load();
  }

  async function handleDelete(u: AdminUserRow) {
    if (!confirm(`Remove ${u.email}? They'll lose access immediately.`)) return;
    setError(null);
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Could not remove the account.");
      return;
    }
    load();
  }

  if (role === undefined || users === null) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (role !== "admin") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Admins only.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Users</h1>
        <p className="mt-1 text-sm text-slate-500">
          Who can sign in to this dashboard, and what they can do.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {justCreated && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-medium text-amber-900">
            Account created for {justCreated.email}
          </p>
          <p className="mt-1 text-amber-800">
            Temporary password (shown once — share it with them now):{" "}
            <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono">
              {justCreated.temporaryPassword}
            </code>
          </p>
          <button
            onClick={() => setJustCreated(null)}
            className="mt-2 text-xs text-amber-700 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Email
          </span>
          <input
            type="email"
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Role
          </span>
          <select
            className="input"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as Role)}
          >
            <option value="team">Team</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={creating || !email}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {creating ? "Creating…" : "Add user"}
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Added</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id}>
                  <td className="px-4 py-3 text-slate-900">
                    {u.email}
                    {isSelf && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs disabled:opacity-50"
                      value={u.role}
                      disabled={isSelf}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                    >
                      <option value="team">Team</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!isSelf && (
                      <button
                        onClick={() => handleDelete(u)}
                        className="text-xs text-slate-400 hover:text-red-500"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
