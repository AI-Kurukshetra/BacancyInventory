"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentOrganizationId } from "@/lib/currentOrganization";
import { Trash2 } from "lucide-react";

type VendorRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  is_active: boolean;
};

export default function VendorsPage() {
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadVendors() {
    setLoading(true);
    const orgId = await getCurrentOrganizationId();
    if (!orgId) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("vendors")
      .select("id, name, email, phone, gstin, is_active")
      .eq("organization_id", orgId)
      .order("name", { ascending: true });

    if (!error && data) {
      setVendors(data as VendorRow[]);
    }
    setLoading(false);
  }

  async function handleDelete(vendor: VendorRow) {
    if (!confirm(`Delete "${vendor.name}"? This cannot be undone.`)) return;
    setError(null);
    setDeletingId(vendor.id);
    const { error: deleteError } = await supabase.from("vendors").delete().eq("id", vendor.id);
    setDeletingId(null);
    if (deleteError) {
      setError(deleteError.code === "23503" ? "Cannot delete: vendor has bills." : deleteError.message);
      return;
    }
    await loadVendors();
  }

  useEffect(() => {
    loadVendors();
  }, []);

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Vendors</h1>
          <p className="text-xs text-slate-500">
            Store supplier details for purchase orders and bills.
          </p>
        </div>
        <Link
          href="/purchases/vendors/new"
          className="inline-flex items-center rounded-full bg-red-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-red-700"
        >
          + New vendor
        </Link>
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-4 py-3">Name</th>
              <th className="border-b border-slate-200 px-4 py-3">Email</th>
              <th className="border-b border-slate-200 px-4 py-3">Phone</th>
              <th className="border-b border-slate-200 px-4 py-3">GSTIN</th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">
                Status
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {error && (
              <tr>
                <td colSpan={6} className="bg-red-50 px-4 py-2 text-sm text-red-700">
                  {error}
                </td>
              </tr>
            )}
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-xs text-slate-500"
                >
                  Loading vendors...
                </td>
              </tr>
            ) : vendors.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-xs text-slate-500"
                >
                  No vendors yet. Add your first supplier to start raising
                  purchase bills.
                </td>
              </tr>
            ) : (
              vendors.map((vendor) => (
                <tr
                  key={vendor.id}
                  className="border-t border-slate-100 text-sm hover:bg-slate-50"
                >
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-slate-900">
                      {vendor.name}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {vendor.email ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {vendor.phone ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {vendor.gstin ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        vendor.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {vendor.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(vendor)}
                      disabled={!!deletingId}
                      className="inline-flex items-center justify-center rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      title="Delete vendor"
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

