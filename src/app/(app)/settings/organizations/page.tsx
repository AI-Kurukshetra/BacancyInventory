"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Building, PlusCircle, Trash2, ArrowLeft } from "lucide-react";

type OrgRow = {
  id: string;
  name: string;
  gstin: string | null;
  country: string | null;
  created_at: string;
};

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadOrganizations() {
    setLoading(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: memberships } = await supabase
      .from("organization_users")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .eq("status", "active");

    const ids = (memberships ?? []).map((m) => m.organization_id);
    if (ids.length === 0) {
      setOrganizations([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, gstin, country, created_at")
      .in("id", ids)
      .order("name", { ascending: true });

    if (error) {
      setError(error.message);
      setOrganizations([]);
    } else {
      setOrganizations((data ?? []) as OrgRow[]);
    }
    setLoading(false);
  }

  async function handleDelete(org: OrgRow) {
    if (
      !confirm(
        `Delete organization "${org.name}"? All data (invoices, products, etc.) for this organization will be permanently removed. This cannot be undone.`
      )
    )
      return;
    setError(null);
    setDeletingId(org.id);
    const { error: deleteError } = await supabase
      .from("organizations")
      .delete()
      .eq("id", org.id);
    setDeletingId(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    await loadOrganizations();
  }

  useEffect(() => {
    loadOrganizations();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
            <Building className="h-6 w-6 text-red-600" />
            Organizations
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage organizations you administer. You can create a new organization or remove one (all its data will be deleted).
          </p>
        </div>
        <Link
          href="/onboarding?new=1"
          className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-red-700"
        >
          <PlusCircle className="h-5 w-5" />
          Create organization
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-4 py-3">Name</th>
              <th className="border-b border-slate-200 px-4 py-3">GSTIN</th>
              <th className="border-b border-slate-200 px-4 py-3">Country</th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  Loading organizations...
                </td>
              </tr>
            ) : organizations.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  No organizations yet.{" "}
                  <Link
                    href="/onboarding?new=1"
                    className="font-medium text-red-600 hover:text-red-700"
                  >
                    Create your first organization
                  </Link>
                </td>
              </tr>
            ) : (
              organizations.map((org) => (
                <tr
                  key={org.id}
                  className="border-t border-slate-100 text-sm hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {org.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{org.gstin ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {org.country ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(org)}
                      disabled={!!deletingId}
                      className="inline-flex items-center justify-center rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      title="Delete organization"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
