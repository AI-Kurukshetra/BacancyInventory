"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentOrganizationId } from "@/lib/currentOrganization";
import { Trash2 } from "lucide-react";

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  uom: string | null;
  sales_price: number | null;
  reorder_level: number | null;
  is_active: boolean;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadProducts() {
    setLoading(true);
    const orgId = await getCurrentOrganizationId();
    if (!orgId) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, sku, uom, sales_price, reorder_level, is_active"
      )
      .eq("organization_id", orgId)
      .order("name", { ascending: true });

    if (!error && data) {
      setProducts(data as ProductRow[]);
    }
    setLoading(false);
  }

  async function handleDelete(product: ProductRow) {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    setError(null);
    setDeletingId(product.id);
    const { error: deleteError } = await supabase.from("products").delete().eq("id", product.id);
    setDeletingId(null);
    if (deleteError) {
      setError(deleteError.code === "23503" ? "Cannot delete: product is used in invoices or stock." : deleteError.message);
      return;
    }
    await loadProducts();
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const filtered = products.filter((product) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      product.name.toLowerCase().includes(q) ||
      (product.sku ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            Products &amp; Items
          </h1>
          <p className="text-xs text-slate-500">
            Maintain your complete product catalog with pricing, GST, and
            reorder levels.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or SKU"
            className="w-40 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm outline-none ring-0 transition focus:w-56 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 md:w-56"
          />
          <Link
            href="/inventory/products/new"
            className="inline-flex items-center rounded-full bg-red-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-red-700"
          >
            + New product
          </Link>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-4 py-3">Name</th>
              <th className="border-b border-slate-200 px-4 py-3">SKU</th>
              <th className="border-b border-slate-200 px-4 py-3">UOM</th>
              <th className="border-b border-slate-200 px-4 py-3">
                Sales price
              </th>
              <th className="border-b border-slate-200 px-4 py-3">
                Reorder level
              </th>
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
                <td colSpan={7} className="bg-red-50 px-4 py-2 text-sm text-red-700">
                  {error}
                </td>
              </tr>
            )}
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-xs text-slate-500"
                >
                  Loading products...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-xs text-slate-500"
                >
                  No products found. Start by creating your first item.
                </td>
              </tr>
            ) : (
              filtered.map((product) => (
                <tr
                  key={product.id}
                  className="group border-t border-slate-100 text-sm hover:bg-slate-50"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/inventory/products/${product.id}`}
                      className="font-medium text-slate-900 hover:text-red-600"
                    >
                      {product.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {product.sku ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {product.uom ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-900">
                    {product.sales_price != null
                      ? `₹${product.sales_price.toLocaleString("en-IN", {
                          maximumFractionDigits: 2,
                        })}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {product.reorder_level != null
                      ? product.reorder_level
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        product.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {product.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(product)}
                      disabled={!!deletingId}
                      className="inline-flex items-center justify-center rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      title="Delete product"
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

