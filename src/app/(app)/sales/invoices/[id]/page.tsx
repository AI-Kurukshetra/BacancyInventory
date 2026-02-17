"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Printer, Download } from "lucide-react";

type Customer = {
  name: string | null;
  email: string | null;
  phone: string | null;
  billing_address: unknown;
  gstin: string | null;
};

type Product = { name: string | null };

type InvoiceItem = {
  id: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  line_total: number | null;
  tax_rate: number | null;
  products: Product | null;
};

type Invoice = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  status: string;
  currency: string;
  subtotal: number | null;
  total_tax: number | null;
  total_amount: number | null;
  notes: string | null;
  customers: Customer | null;
  invoice_items: InvoiceItem[];
};

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return `₹${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id, invoice_number, invoice_date, due_date, status, currency, subtotal, total_tax, total_amount, notes, customers(name, email, phone, billing_address, gstin), invoice_items(id, description, quantity, unit_price, line_total, tax_rate, products(name))"
        )
        .eq("id", id)
        .single();

      if (error || !data) {
        setError(error?.message ?? "Invoice not found.");
        setLoading(false);
        return;
      }
      setInvoice(data as unknown as Invoice);
      setLoading(false);
    })();
  }, [id]);

  function handlePrint() {
    window.print();
  }

  function handleDownload() {
    if (!invoice) return;
    const customer = invoice.customers;
    const custName = customer?.name ?? "";
    const custAddr = customer?.billing_address && typeof customer.billing_address === "object"
      ? (customer.billing_address as Record<string, string>).line1 ?? ""
      : "";
    const custGst = customer?.gstin ?? "";

    const rows = (invoice.invoice_items ?? []).map(
      (line) =>
        `<tr>
          <td style="padding:8px;border:1px solid #e2e8f0">${(line.products?.name ?? line.description ?? "—").replace(/</g, "&lt;")}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;text-align:right">${line.quantity}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;text-align:right">${formatCurrency(line.unit_price)}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;text-align:right">${formatCurrency(line.line_total)}</td>
        </tr>`
    ).join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoice.invoice_number}</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 24px; color: #1e293b; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 1.5rem; color: #dc2626; margin-bottom: 0; }
    .meta { color: #64748b; font-size: 0.875rem; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { text-align: left; padding: 8px; border: 1px solid #e2e8f0; background: #f8fafc; }
    .total-row { font-weight: 600; background: #fef2f2; }
  </style>
</head>
<body>
  <h1>Bacancy Inventory</h1>
  <p class="meta">Invoice</p>
  <p><strong>Invoice #</strong> ${invoice.invoice_number} &nbsp; <strong>Date</strong> ${invoice.invoice_date?.slice(0, 10) ?? "—"}</p>
  <p><strong>Bill to</strong><br/>${custName.replace(/</g, "&lt;")}<br/>${custAddr.replace(/</g, "&lt;")}${custGst ? `<br/>GSTIN: ${custGst}` : ""}</p>
  <table>
    <thead><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit price</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p><strong>Subtotal</strong> ${formatCurrency(invoice.subtotal)} &nbsp; <strong>Tax</strong> ${formatCurrency(invoice.total_tax)} &nbsp; <strong>Total</strong> ${formatCurrency(invoice.total_amount)}</p>
  ${invoice.notes ? `<p><strong>Notes</strong> ${invoice.notes.replace(/</g, "&lt;")}</p>` : ""}
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) {
      alert("Please allow popups to download the invoice.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 250);
  }

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-slate-500">
        Loading invoice...
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">{error ?? "Invoice not found."}</p>
        <Link
          href="/sales/invoices"
          className="inline-flex items-center text-sm font-medium text-red-600 hover:text-red-700"
        >
          ← Back to invoices
        </Link>
      </div>
    );
  }

  const customer = invoice.customers;
  const items = invoice.invoice_items ?? [];

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-only-ref, .print-only-ref * { visibility: visible; }
          .print-only-ref { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/sales/invoices"
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            ← Back to invoices
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            Invoice {invoice.invoice_number}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>
      </div>

      <div
        ref={printRef}
        className="print-only-ref overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h2 className="text-lg font-semibold text-red-600">Bacancy Inventory</h2>
          <p className="text-xs text-slate-500">Invoice</p>
        </div>
        <div className="grid gap-6 p-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Invoice details
            </p>
            <p className="mt-1 font-medium text-slate-900">{invoice.invoice_number}</p>
            <p className="text-sm text-slate-600">
              Date: {invoice.invoice_date?.slice(0, 10) ?? "—"}
              {invoice.due_date && ` · Due: ${invoice.due_date.slice(0, 10)}`}
            </p>
            <span
              className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
                invoice.status === "paid"
                  ? "bg-emerald-50 text-emerald-700"
                  : invoice.status === "overdue"
                  ? "bg-rose-50 text-rose-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {invoice.status}
            </span>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Bill to
            </p>
            <p className="mt-1 font-medium text-slate-900">{customer?.name ?? "—"}</p>
            {customer?.email && (
              <p className="text-sm text-slate-600">{customer.email}</p>
            )}
            {customer?.phone && (
              <p className="text-sm text-slate-600">{customer.phone}</p>
            )}
            {customer?.gstin && (
              <p className="text-sm text-slate-600">GSTIN: {customer.gstin}</p>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 px-6 py-4">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-4">Item</th>
                <th className="pb-2 pr-4 text-right">Qty</th>
                <th className="pb-2 pr-4 text-right">Unit price</th>
                <th className="pb-2 pr-4 text-right">Tax %</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((line) => (
                <tr key={line.id} className="border-b border-slate-100">
                  <td className="py-2.5 pr-4 font-medium text-slate-900">
                    {line.products?.name ?? line.description ?? "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-slate-600">
                    {line.quantity}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-slate-600">
                    {formatCurrency(line.unit_price)}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-slate-600">
                    {line.tax_rate != null ? `${line.tax_rate}%` : "—"}
                  </td>
                  <td className="py-2.5 text-right font-medium text-slate-900">
                    {formatCurrency(line.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 bg-slate-50/50 px-6 py-4">
          <div className="flex flex-wrap items-center justify-end gap-6 text-sm">
            <span className="text-slate-600">
              Subtotal: <strong className="text-slate-900">{formatCurrency(invoice.subtotal)}</strong>
            </span>
            <span className="text-slate-600">
              Tax: <strong className="text-slate-900">{formatCurrency(invoice.total_tax)}</strong>
            </span>
            <span className="text-base font-semibold text-slate-900">
              Total: {formatCurrency(invoice.total_amount)}
            </span>
          </div>
          {invoice.notes && (
            <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
              {invoice.notes}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
