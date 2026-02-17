"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentOrganizationId } from "@/lib/currentOrganization";

export default function NewProductPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [uom, setUom] = useState("pcs");
  const [hsn, setHsn] = useState("");
  const [salesPrice, setSalesPrice] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [reorderLevel, setReorderLevel] = useState("");
  const [taxRate, setTaxRate] = useState("18");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setError(userError?.message ?? "You must be signed in.");
      setLoading(false);
      return;
    }

    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) {
      setError("No organization linked to this user. Complete onboarding first.");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("products").insert({
      organization_id: organizationId,
      name,
      sku: sku || null,
      uom,
      hsn_sac: hsn || null,
      sales_price: salesPrice ? Number(salesPrice) : null,
      purchase_price: purchasePrice ? Number(purchasePrice) : null,
      reorder_level: reorderLevel ? Number(reorderLevel) : null,
      tax_rate: taxRate ? Number(taxRate) : null,
    });

    setLoading(false);

    if (insertError) {
      if (insertError.code === "23505" && insertError.message?.includes("idx_products_org_sku")) {
        setError("A product with this SKU already exists. Use a different SKU or leave SKU blank.");
      } else {
        setError(insertError.message);
      }
      return;
    }

    router.replace("/inventory/products");
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            New product
          </h1>
          <p className="text-xs text-slate-500">
            Add an item with pricing, GST, and inventory settings.
          </p>
        </div>
        <Link
          href="/inventory/products"
          className="text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          Cancel
        </Link>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <section className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="text-xs font-medium uppercase tracking-wide text-slate-600"
            >
              Item name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              placeholder="Cotton T-shirt"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="sku"
              className="text-xs font-medium uppercase tracking-wide text-slate-600"
            >
              SKU (optional)
            </label>
            <input
              id="sku"
              type="text"
              value={sku}
              onChange={(event) => setSku(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              placeholder="TSHIRT-CTN-001"
            />
            <p className="text-[11px] text-slate-500">
              Must be unique in your organization. Leave blank to auto-manage.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="uom"
              className="text-xs font-medium uppercase tracking-wide text-slate-600"
            >
              Unit of measure
            </label>
            <input
              id="uom"
              type="text"
              value={uom}
              onChange={(event) => setUom(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="hsn"
              className="text-xs font-medium uppercase tracking-wide text-slate-600"
            >
              HSN / SAC (optional)
            </label>
            <input
              id="hsn"
              type="text"
              value={hsn}
              onChange={(event) => setHsn(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              placeholder="6109"
            />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label
              htmlFor="salesPrice"
              className="text-xs font-medium uppercase tracking-wide text-slate-600"
            >
              Sales price
            </label>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2">
              <span className="text-xs text-slate-500">₹</span>
              <input
                id="salesPrice"
                type="number"
                min="0"
                step="0.01"
                value={salesPrice}
                onChange={(event) => setSalesPrice(event.target.value)}
                className="w-full border-none bg-transparent px-1 py-1.5 text-sm text-slate-900 outline-none ring-0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="purchasePrice"
              className="text-xs font-medium uppercase tracking-wide text-slate-600"
            >
              Purchase price
            </label>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2">
              <span className="text-xs text-slate-500">₹</span>
              <input
                id="purchasePrice"
                type="number"
                min="0"
                step="0.01"
                value={purchasePrice}
                onChange={(event) => setPurchasePrice(event.target.value)}
                className="w-full border-none bg-transparent px-1 py-1.5 text-sm text-slate-900 outline-none ring-0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="taxRate"
              className="text-xs font-medium uppercase tracking-wide text-slate-600"
            >
              GST rate
            </label>
            <select
              id="taxRate"
              value={taxRate}
              onChange={(event) => setTaxRate(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            >
              <option value="">No tax</option>
              <option value="5">5%</option>
              <option value="12">12%</option>
              <option value="18">18%</option>
              <option value="28">28%</option>
            </select>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label
              htmlFor="reorderLevel"
              className="text-xs font-medium uppercase tracking-wide text-slate-600"
            >
              Reorder level
            </label>
            <input
              id="reorderLevel"
              type="number"
              min="0"
              step="1"
              value={reorderLevel}
              onChange={(event) => setReorderLevel(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              placeholder="50"
            />
          </div>
        </section>

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
            Discard
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center rounded-full bg-red-600 px-5 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Saving..." : "Save product"}
          </button>
        </div>
      </form>
    </div>
  );
}

