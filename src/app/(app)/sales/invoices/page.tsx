"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentOrganizationId } from "@/lib/currentOrganization";
import { Trash2 } from "lucide-react";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_name: string | null;
  total_amount: number | null;
  status: string;
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadInvoices() {
    setLoading(true);
    const orgId = await getCurrentOrganizationId();
    if (!orgId) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("invoices")
      .select("id, invoice_number, invoice_date, total_amount, status, customers(name)")
      .eq("organization_id", orgId)
      .order("invoice_date", { ascending: false });

    if (!error && data) {
      setInvoices(
        data.map((row) => ({
          id: row.id,
          invoice_number: row.invoice_number,
          invoice_date: row.invoice_date,
          total_amount: row.total_amount,
          status: row.status,
          customer_name: (row as any).customers?.name ?? null,
        }))
      );
    }
    setLoading(false);
  }

  async function handleDelete(invoice: InvoiceRow) {
    if (!confirm(`Delete invoice "${invoice.invoice_number}"? This cannot be undone.`)) return;
    setError(null);
    setDeletingId(invoice.id);
    const { error: deleteError } = await supabase.from("invoices").delete().eq("id", invoice.id);
    setDeletingId(null);
    if (deleteError) {
      setError(deleteError.code === "23503" ? "Cannot delete: invoice is referenced elsewhere." : deleteError.message);
      return;
    }
    await loadInvoices();
  }

  useEffect(() => {
    loadInvoices();
  }, []);

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Sales invoices</h1>
          <p className="text-xs text-slate-500">
            Create GST-ready invoices and track collections.
          </p>
        </div>
        <Link
          href="/sales/invoices/new"
          className="inline-flex items-center rounded-full bg-red-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-red-700"
        >
          + New invoice
        </Link>
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-4 py-3">Invoice #</th>
              <th className="border-b border-slate-200 px-4 py-3">Date</th>
              <th className="border-b border-slate-200 px-4 py-3">Customer</th>
              <th className="border-b border-slate-200 px-4 py-3">Amount</th>
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
                  Loading invoices...
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-xs text-slate-500"
                >
                  No invoices yet. Create your first sale to see it here.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="border-t border-slate-100 text-sm hover:bg-slate-50"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/sales/invoices/${invoice.id}`}
                      className="font-medium text-slate-900 hover:text-red-600"
                    >
                      {invoice.invoice_number}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {invoice.invoice_date?.slice(0, 10)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {invoice.customer_name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-900">
                    {invoice.total_amount != null
                      ? `₹${invoice.total_amount.toLocaleString("en-IN", {
                          maximumFractionDigits: 0,
                        })}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        invoice.status === "paid"
                          ? "bg-emerald-50 text-emerald-700"
                          : invoice.status === "overdue"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(invoice)}
                      disabled={!!deletingId}
                      className="inline-flex items-center justify-center rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      title="Delete invoice"
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

