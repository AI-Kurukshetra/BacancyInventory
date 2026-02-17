"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentOrganizationId } from "@/lib/currentOrganization";
import { Trash2 } from "lucide-react";

type CustomerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  is_active: boolean;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadCustomers() {
    setLoading(true);
    const orgId = await getCurrentOrganizationId();
    if (!orgId) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, email, phone, gstin, is_active")
      .eq("organization_id", orgId)
      .order("name", { ascending: true });

    if (!error && data) {
      setCustomers(data as CustomerRow[]);
    }
    setLoading(false);
  }

  async function handleDelete(customer: CustomerRow) {
    if (!confirm(`Delete "${customer.name}"? This cannot be undone.`)) return;
    setError(null);
    setDeletingId(customer.id);
    const { error: deleteError } = await supabase.from("customers").delete().eq("id", customer.id);
    setDeletingId(null);
    if (deleteError) {
      setError(deleteError.code === "23503" ? "Cannot delete: customer has invoices." : deleteError.message);
      return;
    }
    await loadCustomers();
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  const filtered = customers.filter((customer) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      customer.name.toLowerCase().includes(q) ||
      (customer.email ?? "").toLowerCase().includes(q) ||
      (customer.phone ?? "").includes(search)
    );
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Customers</h1>
          <p className="text-xs text-slate-500">
            Add and manage customers for sales and invoicing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone"
            className="w-44 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20 md:w-56"
          />
          <Link
            href="/sales/customers/new"
            className="inline-flex items-center rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-red-700"
          >
            + New customer
          </Link>
        </div>
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
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  Loading customers...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  No customers yet.{" "}
                  <Link
                    href="/sales/customers/new"
                    className="font-medium text-red-600 hover:text-red-700"
                  >
                    Create your first customer
                  </Link>{" "}
                  to start raising invoices.
                </td>
              </tr>
            ) : (
              filtered.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-t border-slate-100 text-sm hover:bg-slate-50"
                >
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    {customer.name}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {customer.email ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {customer.phone ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {customer.gstin ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        customer.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {customer.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(customer)}
                      disabled={!!deletingId}
                      className="inline-flex items-center justify-center rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      title="Delete customer"
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
