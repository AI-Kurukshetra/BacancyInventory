"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentOrganizationId } from "@/lib/currentOrganization";
import {
  Users,
  UserPlus,
  Shield,
  ShoppingCart,
  Briefcase,
  Warehouse,
  FileText,
  Eye,
  Trash2,
  Copy,
  ArrowLeft,
  Check,
} from "lucide-react";

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "sales_manager", label: "Sales Manager" },
  { value: "purchase_manager", label: "Purchase Manager" },
  { value: "warehouse_staff", label: "Warehouse Staff" },
  { value: "accountant", label: "Accountant" },
  { value: "viewer", label: "Viewer" },
] as const;

const ROLE_PERMISSIONS: { value: string; label: string; description: string; icon: React.ReactNode }[] = [
  { value: "admin", label: "Admin", description: "Full access; manage team, settings, and all data.", icon: <Shield className="h-5 w-5" /> },
  { value: "sales_manager", label: "Sales Manager", description: "Sales, customers, invoices.", icon: <ShoppingCart className="h-5 w-5" /> },
  { value: "purchase_manager", label: "Purchase Manager", description: "Purchases, vendors, bills.", icon: <Briefcase className="h-5 w-5" /> },
  { value: "warehouse_staff", label: "Warehouse Staff", description: "Inventory, stock adjustments, warehouses.", icon: <Warehouse className="h-5 w-5" /> },
  { value: "accountant", label: "Accountant", description: "Reports, payments, financial data.", icon: <FileText className="h-5 w-5" /> },
  { value: "viewer", label: "Viewer", description: "Read-only access to assigned areas.", icon: <Eye className="h-5 w-5" /> },
];

type Member = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  email: string | null;
  full_name: string | null;
};

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("viewer");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      const organizationId = await getCurrentOrganizationId();
      if (!organizationId) return;

      const { data: membership } = await supabase
        .from("organization_users")
        .select("role")
        .eq("user_id", user.id)
        .eq("organization_id", organizationId)
        .limit(1)
        .single();

      setCurrentUserRole(membership?.role ?? null);

      const { data: rows } = await supabase
        .from("organization_users")
        .select("id, user_id, role, status")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (!rows?.length) {
        setLoading(false);
        return;
      }

      const userIds = [...new Set(rows.map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, { email: p.email, full_name: p.full_name }])
      );

      setMembers(
        rows.map((r) => ({
          id: r.id,
          user_id: r.user_id,
          role: r.role,
          status: r.status,
          email: profileMap.get(r.user_id)?.email ?? null,
          full_name: profileMap.get(r.user_id)?.full_name ?? null,
        }))
      );
      setLoading(false);
    }

    load();
  }, []);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInviteLink(null);
    setInviteSending(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be signed in.");
      setInviteSending(false);
      return;
    }

    const organizationId = await getCurrentOrganizationId();
    if (!organizationId || currentUserRole !== "admin") {
      setError("Only admins can invite members.");
      setInviteSending(false);
      return;
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error: inviteError } = await supabase
      .from("organization_invitations")
      .insert({
        organization_id: organizationId,
        email: inviteEmail.trim(),
        role: inviteRole,
        token,
        invited_by: user.id,
        expires_at: expiresAt.toISOString(),
      });

    setInviteSending(false);

    if (inviteError) {
      setError(inviteError.message);
      return;
    }

    const base =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    setInviteLink(`${base}/invite/accept?token=${token}`);
    setInviteEmail("");
  }

  function copyInviteLink() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function updateRole(memberId: string, newRole: string) {
    if (currentUserRole !== "admin") return;

    const { error: updateError } = await supabase
      .from("organization_users")
      .update({ role: newRole })
      .eq("id", memberId);

    if (!updateError) {
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
    }
  }

  async function removeMember(memberId: string, memberUserId: string) {
    if (currentUserRole !== "admin") return;
    if (memberUserId === currentUserId) {
      setError("You cannot remove yourself.");
      return;
    }

    const { error: deleteError } = await supabase
      .from("organization_users")
      .delete()
      .eq("id", memberId);

    if (!deleteError) {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setError(null);
    } else {
      setError(deleteError.message);
    }
  }

  const isAdmin = currentUserRole === "admin";

  function getInitial(name: string | null, email: string | null) {
    if (name?.trim()) return name.trim().slice(0, 1).toUpperCase();
    if (email?.trim()) return email.trim().slice(0, 1).toUpperCase();
    return "?";
  }

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Team</h1>
            <p className="text-sm text-neutral-500">
              Manage members and roles. Only admins can invite or remove users.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isAdmin && (
        <section className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm transition hover:shadow-md">
          <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
            <UserPlus className="h-5 w-5 text-red-600" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
              Invite member
            </h2>
          </div>
          <div className="p-6">
            <p className="mb-4 text-sm text-neutral-500">
              Create a link and share it. The person signs up or logs in, then accepts to join your organization.
            </p>
            <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-4">
              <div className="min-w-[220px] flex-1 space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-neutral-600">
                  Email
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  placeholder="colleague@company.com"
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                />
              </div>
              <div className="min-w-[160px] space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-neutral-600">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={inviteSending}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
              >
                {inviteSending ? "Creating…" : "Create invite link"}
              </button>
            </form>
            {inviteLink && (
              <div className="mt-4 flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
                <p className="text-xs font-medium text-neutral-600">Invite link — copy and share</p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="flex-1 break-all rounded bg-white px-3 py-2 text-xs text-neutral-800">
                    {inviteLink}
                  </code>
                  <button
                    type="button"
                    onClick={copyInviteLink}
                    className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm transition hover:shadow-md">
        <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
          <Users className="h-5 w-5 text-neutral-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
            Members
          </h2>
        </div>
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-neutral-500">
            Loading…
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
              <Users className="h-7 w-7" />
            </div>
            <p className="mt-3 text-sm font-medium text-neutral-600">No members yet</p>
            <p className="text-xs text-neutral-500">Invite someone using the form above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <th className="px-6 py-3">Member</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Status</th>
                  {isAdmin && <th className="px-6 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {members.map((m) => (
                  <tr key={m.id} className="transition hover:bg-neutral-50/50">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-semibold text-neutral-700">
                          {getInitial(m.full_name, m.email)}
                        </div>
                        <div>
                          <p className="font-medium text-neutral-900">
                            {m.full_name || m.email || "—"}
                          </p>
                          {m.email && m.full_name && (
                            <p className="text-xs text-neutral-500">{m.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      {isAdmin ? (
                        <select
                          value={m.role}
                          onChange={(e) => updateRole(m.id, e.target.value)}
                          className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 outline-none transition focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
                        >
                          {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-medium text-neutral-700">
                          {ROLES.find((r) => r.value === m.role)?.label ?? m.role}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          m.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-neutral-100 text-neutral-600"
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => removeMember(m.id, m.user_id)}
                          disabled={m.user_id === currentUserId}
                          className="inline-flex items-center gap-1.5 rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Remove member"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm transition hover:shadow-md">
        <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
          <Shield className="h-5 w-5 text-neutral-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
            Role permissions
          </h2>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          {ROLE_PERMISSIONS.map((role) => (
            <div
              key={role.value}
              className="flex gap-4 rounded-xl border border-neutral-200/80 bg-neutral-50/30 p-4 transition hover:border-neutral-300 hover:bg-neutral-50/50"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-neutral-600 shadow-sm ring-1 ring-neutral-200/80">
                {role.icon}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-neutral-900">{role.label}</p>
                <p className="mt-0.5 text-xs text-neutral-600">{role.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
