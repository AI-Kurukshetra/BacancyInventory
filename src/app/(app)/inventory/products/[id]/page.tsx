"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentOrganizationId } from "@/lib/currentOrganization";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  uom: string | null;
  hsn_sac: string | null;
  sales_price: number | null;
  purchase_price: number | null;
  reorder_level: number | null;
  tax_rate: number | null;
  is_active: boolean;
};

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProduct() {
      const orgId = await getCurrentOrganizationId();
      if (!orgId) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, sku, uom, hsn_sac, sales_price, purchase_price, reorder_level, tax_rate, is_active"
        )
        .eq("id", productId)
        .eq("organization_id", orgId)
        .single();

      if (error) {
        setError(error.message);
      } else {
        setProduct(data as Product);
      }
      setLoading(false);
    }

    if (productId) {
      loadProduct();
    }
  }, [productId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!product) return;
    setError(null);
    setSaving(true);

    const { error: updateError } = await supabase
      .from("products")
      .update({
        name: product.name,
        sku: product.sku,
        uom: product.uom,
        hsn_sac: product.hsn_sac,
        sales_price: product.sales_price,
        purchase_price: product.purchase_price,
        reorder_level: product.reorder_level,
        tax_rate: product.tax_rate,
        is_active: product.is_active,
      })
      .eq("id", product.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.replace("/inventory/products");
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Loading product...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="rounded-2xl border border-rose-100 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm">
        Product not found.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            Edit product
          </h1>
          <p className="text-xs text-slate-500">
            Update pricing, GST, or reorder settings for this item.
          </p>
        </div>
        <Link
          href="/inventory/products"
          className="text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          Back to list
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
              value={product.name}
              onChange={(event) =>
                setProduct({ ...product, name: event.target.value })
              }
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="sku"
              className="text-xs font-medium uppercase tracking-wide text-slate-600"
            >
              SKU
            </label>
            <input
              id="sku"
              type="text"
              value={product.sku ?? ""}
              onChange={(event) =>
                setProduct({ ...product, sku: event.target.value || null })
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            />
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
              value={product.uom ?? ""}
              onChange={(event) =>
                setProduct({ ...product, uom: event.target.value || null })
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="hsn"
              className="text-xs font-medium uppercase tracking-wide text-slate-600"
            >
              HSN / SAC
            </label>
            <input
              id="hsn"
              type="text"
              value={product.hsn_sac ?? ""}
              onChange={(event) =>
                setProduct({ ...product, hsn_sac: event.target.value || null })
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
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
            <input
              id="salesPrice"
              type="number"
              min="0"
              step="0.01"
              value={product.sales_price ?? ""}
              onChange={(event) =>
                setProduct({
                  ...product,
                  sales_price: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="purchasePrice"
              className="text-xs font-medium uppercase tracking-wide text-slate-600"
            >
              Purchase price
            </label>
            <input
              id="purchasePrice"
              type="number"
              min="0"
              step="0.01"
              value={product.purchase_price ?? ""}
              onChange={(event) =>
                setProduct({
                  ...product,
                  purchase_price: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="taxRate"
              className="text-xs font-medium uppercase tracking-wide text-slate-600"
            >
              GST rate
            </label>
            <input
              id="taxRate"
              type="number"
              min="0"
              step="0.01"
              value={product.tax_rate ?? ""}
              onChange={(event) =>
                setProduct({
                  ...product,
                  tax_rate: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            />
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
              value={product.reorder_level ?? ""}
              onChange={(event) =>
                setProduct({
                  ...product,
                  reorder_level: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-600">
              Status
            </span>
            <button
              type="button"
              onClick={() =>
                setProduct({ ...product, is_active: !product.is_active })
              }
              className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-medium shadow-sm transition ${
                product.is_active
                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {product.is_active ? "Active" : "Inactive"}
            </button>
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
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center rounded-full bg-red-600 px-5 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

