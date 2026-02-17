"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentOrganizationId } from "@/lib/currentOrganization";

type Option = { id: string; name: string };

export default function NewStockAdjustmentPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Option[]>([]);
  const [products, setProducts] = useState<Option[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [productId, setProductId] = useState("");
  const [type, setType] = useState<"increase" | "decrease">("increase");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
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
      const [{ data: warehouseData }, { data: productData }] =
        await Promise.all([
          supabase.from("warehouses").select("id, name").eq("organization_id", orgId).order("name"),
          supabase.from("products").select("id, name").eq("organization_id", orgId).order("name"),
        ]);

      setWarehouses((warehouseData ?? []) as Option[]);
      setProducts((productData ?? []) as Option[]);
      setLoading(false);
    }

    loadLookups();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const qty = Number(quantity || "0");
    if (!warehouseId || !productId || !qty || qty <= 0) {
      setError("Warehouse, product, and quantity are required.");
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
      setError("No organization linked. Complete onboarding first.");
      setSaving(false);
      return;
    }

    const { data: adjustment, error: adjustmentError } = await supabase
      .from("stock_adjustments")
      .insert({
        organization_id: organizationId,
        warehouse_id: warehouseId,
        adjustment_type: type,
        reason: reason || null,
      })
      .select("id, organization_id")
      .single();

    if (adjustmentError || !adjustment) {
      setError(adjustmentError?.message ?? "Unable to create adjustment.");
      setSaving(false);
      return;
    }

    const qtyChange = type === "increase" ? qty : -qty;

    const { error: ledgerError } = await supabase.from("stock_ledger").insert({
      organization_id: adjustment.organization_id,
      product_id: productId,
      warehouse_id: warehouseId,
      qty_change: qtyChange,
      reference_type: "adjustment",
      reference_id: adjustment.id,
      notes: reason || null,
    });

    setSaving(false);

    if (ledgerError) {
      setError(ledgerError.message);
      return;
    }

    router.replace("/dashboard");
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            New stock adjustment
          </h1>
          <p className="text-xs text-slate-500">
            Increase or decrease stock for a product in a specific warehouse.
          </p>
        </div>
        <Link
          href="/dashboard"
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
          <p className="text-sm text-slate-500">Loading warehouses...</p>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="warehouse"
                  className="text-xs font-medium uppercase tracking-wide text-slate-600"
                >
                  Warehouse
                </label>
                <select
                  id="warehouse"
                  value={warehouseId}
                  onChange={(event) => setWarehouseId(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                >
                  <option value="">Select warehouse</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="product"
                  className="text-xs font-medium uppercase tracking-wide text-slate-600"
                >
                  Product
                </label>
                <select
                  id="product"
                  value={productId}
                  onChange={(event) => setProductId(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                >
                  <option value="">Select product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-600">
                  Adjustment type
                </span>
                <div className="inline-flex rounded-full bg-slate-100 p-1 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setType("increase")}
                    className={`rounded-full px-3 py-1 ${
                      type === "increase"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-600"
                    }`}
                  >
                    Increase
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("decrease")}
                    className={`rounded-full px-3 py-1 ${
                      type === "decrease"
                        ? "bg-rose-600 text-white shadow-sm"
                        : "text-slate-600"
                    }`}
                  >
                    Decrease
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="quantity"
                  className="text-xs font-medium uppercase tracking-wide text-slate-600"
                >
                  Quantity
                </label>
                <input
                  id="quantity"
                  type="number"
                  min="0"
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  placeholder="100"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="reason"
                  className="text-xs font-medium uppercase tracking-wide text-slate-600"
                >
                  Reason (optional)
                </label>
                <input
                  id="reason"
                  type="text"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  placeholder="Opening stock, stock take, damage..."
                />
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
            {saving ? "Posting adjustment..." : "Post adjustment"}
          </button>
        </div>
      </form>
    </div>
  );
}

