"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentOrganizationId } from "@/lib/currentOrganization";
import { Trash2 } from "lucide-react";

type BillRow = {
  id: string;
  bill_number: string;
  bill_date: string;
  vendor_name: string | null;
  total_amount: number | null;
  status: string;
};

export default function BillsPage() {
  const [bills, setBills] = useState<BillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadBills() {
    setLoading(true);
    const orgId = await getCurrentOrganizationId();
    if (!orgId) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("bills")
      .select("id, bill_number, bill_date, total_amount, status, vendors(name)")
      .eq("organization_id", orgId)
      .order("bill_date", { ascending: false });

    if (!error && data) {
      setBills(
        data.map((row) => ({
          id: row.id,
          bill_number: row.bill_number,
          bill_date: row.bill_date,
          total_amount: row.total_amount,
          status: row.status,
          vendor_name: (row as any).vendors?.name ?? null,
        }))
      );
    }
    setLoading(false);
  }

  async function handleDelete(bill: BillRow) {
    if (!confirm(`Delete bill "${bill.bill_number}"? This cannot be undone.`)) return;
    setError(null);
    setDeletingId(bill.id);
    const { error: deleteError } = await supabase.from("bills").delete().eq("id", bill.id);
    setDeletingId(null);
    if (deleteError) {
      setError(deleteError.code === "23503" ? "Cannot delete: bill is referenced elsewhere." : deleteError.message);
      return;
    }
    await loadBills();
  }

  useEffect(() => {
    loadBills();
  }, []);

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Purchase bills</h1>
          <p className="text-xs text-slate-500">
            Record vendor bills and update incoming stock.
          </p>
        </div>
        <Link
          href="/purchases/bills/new"
          className="inline-flex items-center rounded-full bg-red-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-red-700"
        >
          + New bill
        </Link>
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-4 py-3">Bill #</th>
              <th className="border-b border-slate-200 px-4 py-3">Date</th>
              <th className="border-b border-slate-200 px-4 py-3">Vendor</th>
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
                  Loading bills...
                </td>
              </tr>
            ) : bills.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-xs text-slate-500"
                >
                  No bills yet. Record vendor bills to see payables here.
                </td>
              </tr>
            ) : (
              bills.map((bill) => (
                <tr
                  key={bill.id}
                  className="border-t border-slate-100 text-sm hover:bg-slate-50"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/purchases/bills/${bill.id}`}
                      className="font-medium text-slate-900 hover:text-red-600"
                    >
                      {bill.bill_number}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {bill.bill_date?.slice(0, 10)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {bill.vendor_name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-900">
                    {bill.total_amount != null
                      ? `₹${bill.total_amount.toLocaleString("en-IN", {
                          maximumFractionDigits: 0,
                        })}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        bill.status === "paid"
                          ? "bg-emerald-50 text-emerald-700"
                          : bill.status === "overdue"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {bill.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(bill)}
                      disabled={!!deletingId}
                      className="inline-flex items-center justify-center rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      title="Delete bill"
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

