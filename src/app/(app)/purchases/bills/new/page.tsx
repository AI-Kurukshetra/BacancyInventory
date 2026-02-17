"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentOrganizationId } from "@/lib/currentOrganization";
import { logActivity } from "@/lib/activityLog";

type Option = { id: string; name: string };

export default function NewBillPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Option[]>([]);
  const [products, setProducts] = useState<
    (Option & { purchase_price: number | null; tax_rate: number | null })[]
  >([]);
  const [vendorId, setVendorId] = useState("");
  const [billDate, setBillDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [lineItems, setLineItems] = useState<
    { productId: string; quantity: string }[]
  >([{ productId: "", quantity: "1" }]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadLookups() {
      const orgId = await getCurrentOrganizationId();
      if (!orgId) {
        setLoading(false);
        return;
      }
      const [{ data: vendorData }, { data: productData }] = await Promise.all([
        supabase.from("vendors").select("id, name").eq("organization_id", orgId).order("name"),
        supabase
          .from("products")
          .select("id, name, purchase_price, tax_rate")
          .eq("organization_id", orgId)
          .order("name"),
      ]);

      setVendors((vendorData ?? []) as Option[]);
      setProducts(
        (productData ?? []) as (Option & {
          purchase_price: number | null;
          tax_rate: number | null;
        })[]
      );
      setLoading(false);
    }

    loadLookups();
  }, []);

  function updateLineItem(
    index: number,
    key: "productId" | "quantity",
    value: string
  ) {
    setLineItems((items) =>
      items.map((item, i) =>
        i === index ? { ...item, [key]: value } : item
      )
    );
  }

  function addLine() {
    setLineItems((items) => [...items, { productId: "", quantity: "1" }]);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const validLines = lineItems.filter(
      (item) => item.productId && Number(item.quantity) > 0
    );
    if (!vendorId || validLines.length === 0) {
      setError("Vendor and at least one product line are required.");
      setSaving(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setError(userError?.message ?? "You must be signed in.");
      setSaving(false);
      return;
    }

    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) {
      setError("No organization linked to this user.");
      setSaving(false);
      return;
    }

    const billNumber = `BILL-${Date.now().toString().slice(-6)}`;

    let subtotal = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    const enrichedLines = validLines.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const qty = Number(item.quantity);
      const cost = product?.purchase_price ?? 0;
      const lineSubtotal = qty * cost;
      const rate = product?.tax_rate ?? 0;
      const taxAmount = (lineSubtotal * rate) / 100;
      const halfTax = taxAmount / 2;

      subtotal += lineSubtotal;
      cgst += halfTax;
      sgst += halfTax;

      return {
        product,
        quantity: qty,
        lineSubtotal,
        rate,
        cgstAmount: halfTax,
        sgstAmount: halfTax,
        igstAmount: 0,
      };
    });

    const totalTax = cgst + sgst + igst;
    const totalAmount = subtotal + totalTax;

    const { data: bill, error: billError } = await supabase
      .from("bills")
      .insert({
        organization_id: organizationId,
        bill_number: billNumber,
        vendor_id: vendorId,
        bill_date: billDate,
        status: "unpaid",
        currency: "INR",
        subtotal,
        cgst_amount: cgst,
        sgst_amount: sgst,
        igst_amount: igst,
        total_tax: totalTax,
        total_amount: totalAmount,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (billError || !bill) {
      setError(billError?.message ?? "Unable to create bill.");
      setSaving(false);
      return;
    }

    const itemsPayload = enrichedLines.map((line) => ({
      bill_id: bill.id,
      product_id: line.product!.id,
      description: line.product!.name,
      quantity: line.quantity,
      unit_price: line.product!.purchase_price ?? 0,
      discount_percent: 0,
      tax_rate: line.rate,
      cgst_amount: line.cgstAmount,
      sgst_amount: line.sgstAmount,
      igst_amount: line.igstAmount,
      line_total: line.lineSubtotal + line.cgstAmount + line.sgstAmount,
    }));

    const { error: itemsError } = await supabase
      .from("bill_items")
      .insert(itemsPayload);

    if (itemsError) {
      setError(itemsError.message);
      setSaving(false);
      return;
    }

    const { data: defaultWarehouse } = await supabase
      .from("warehouses")
      .select("id")
      .eq("is_default", true)
      .limit(1)
      .single();

    const warehouseId = defaultWarehouse?.id;

    if (warehouseId) {
      const { error: ledgerError } = await supabase
        .from("stock_ledger")
        .insert(
          enrichedLines.map((line) => ({
            organization_id: organizationId,
            product_id: line.product!.id,
            warehouse_id: warehouseId,
            qty_change: line.quantity,
            reference_type: "bill",
            reference_id: bill.id,
            unit_cost: line.product!.purchase_price ?? null,
          }))
        );

      if (ledgerError) {
        setError(ledgerError.message);
        setSaving(false);
        return;
      }
    }

    await logActivity({
      organizationId,
      userId: user.id,
      action: "bill.created",
      entityType: "bill",
      entityId: bill.id,
      metadata: {
        bill_number: billNumber,
        total_amount: totalAmount,
      },
    });

    setSaving(false);
    router.replace("/purchases/bills");
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">New bill</h1>
          <p className="text-xs text-slate-500">
            Record a vendor bill and increase stock.
          </p>
        </div>
        <Link
          href="/purchases/bills"
          className="text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          Cancel
        </Link>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        {loading ? (
          <p className="text-sm text-slate-500">Loading vendors...</p>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="vendor"
                    className="text-xs font-medium uppercase tracking-wide text-slate-600"
                  >
                    Vendor
                  </label>
                  <Link
                    href="/purchases/vendors/new"
                    className="text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    + Add vendor
                  </Link>
                </div>
                <select
                  id="vendor"
                  value={vendorId}
                  onChange={(event) => setVendorId(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                >
                  <option value="">Select vendor</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="billDate"
                  className="text-xs font-medium uppercase tracking-wide text-slate-600"
                >
                  Bill date
                </label>
                <input
                  id="billDate"
                  type="date"
                  value={billDate}
                  onChange={(event) => setBillDate(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                />
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Line items
                </h2>
                <button
                  type="button"
                  onClick={addLine}
                  className="text-xs font-medium text-red-600 hover:text-red-700"
                >
                  + Add line
                </button>
              </div>

              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                {lineItems.map((line, index) => (
                  <div
                    key={index}
                    className="grid gap-2 border-b border-slate-200 pb-2 last:border-b-0 last:pb-0 md:grid-cols-3"
                  >
                    <select
                      value={line.productId}
                      onChange={(event) =>
                        updateLineItem(index, "productId", event.target.value)
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                    >
                      <option value="">Select product</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={line.quantity}
                      onChange={(event) =>
                        updateLineItem(index, "quantity", event.target.value)
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                      placeholder="Qty"
                    />
                    <div className="flex items-center justify-end text-[11px] text-slate-500">
                      {(() => {
                        const product = products.find(
                          (p) => p.id === line.productId
                        );
                        if (!product) return "No cost";
                        const qty = Number(line.quantity || "0");
                        const cost = product.purchase_price ?? 0;
                        const total = qty * cost;
                        return `₹${total.toLocaleString("en-IN", {
                          maximumFractionDigits: 0,
                        })}`;
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center rounded-full bg-red-600 px-5 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Recording bill..." : "Record bill"}
          </button>
        </div>
      </form>
    </div>
  );
}

