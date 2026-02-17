"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentOrganizationId } from "@/lib/currentOrganization";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Package,
  AlertCircle,
  ImageIcon,
  TrendingUp,
  Boxes,
  ShoppingBag,
  FileText,
} from "lucide-react";

type SalesKpis = {
  todaySales: number;
  monthSales: number;
  yearSales: number;
  pendingInvoices: number;
  pendingPayments: number;
  paidCount: number;
  totalInvoices: number;
  unconfirmedItems: number;
};

type InventoryKpis = {
  lowStockCount: number;
  quantityInHand: number;
  quantityToBeReceived: number;
  categoryCount: number;
  productCount: number;
  activeProductCount: number;
};

type ChartData = {
  salesByDay: { date: string; amount: number; label: string }[];
  topProducts: { name: string; quantity: number; productId?: string }[];
};

type SalesOrderRow = {
  channel: string;
  draft: number;
  confirmed: number;
  packed: number;
  shipped: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [salesKpis, setSalesKpis] = useState<SalesKpis>({
    todaySales: 0,
    monthSales: 0,
    yearSales: 0,
    pendingInvoices: 0,
    pendingPayments: 0,
    paidCount: 0,
    totalInvoices: 0,
    unconfirmedItems: 0,
  });
  const [inventoryKpis, setInventoryKpis] = useState<InventoryKpis>({
    lowStockCount: 0,
    quantityInHand: 0,
    quantityToBeReceived: 0,
    categoryCount: 0,
    productCount: 0,
    activeProductCount: 0,
  });
  const [chartData, setChartData] = useState<ChartData>({
    salesByDay: [],
    topProducts: [],
  });
  const [poQuantityOrdered, setPoQuantityOrdered] = useState<number>(0);
  const [salesOrderRows, setSalesOrderRows] = useState<SalesOrderRow[]>([]);
  const [poPeriod, setPoPeriod] = useState<"This Month" | "Last Month">("This Month");

  useEffect(() => {
    async function fetchData() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/auth/login");
        return;
      }

      const orgId = await getCurrentOrganizationId();
      if (!orgId) {
        setLoading(false);
        return;
      }

      const today = new Date();
      const startOfToday = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      )
        .toISOString()
        .slice(0, 10);
      const startOfMonth = new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      )
        .toISOString()
        .slice(0, 10);
      const startOfYear = new Date(today.getFullYear(), 0, 1)
        .toISOString()
        .slice(0, 10);

      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const start30 = thirtyDaysAgo.toISOString().slice(0, 10);

      const [
        { data: invoices },
        { data: ledger },
        { data: products },
        { data: invoiceItems },
        { data: categories },
        { data: salesOrders },
        { data: bills },
        { data: billItems },
        { data: purchaseOrders },
        { data: poItems },
      ] = await Promise.all([
        supabase.from("invoices").select("id, total_amount, status, invoice_date").eq("organization_id", orgId),
        supabase
          .from("stock_ledger")
          .select("product_id, qty_change")
          .eq("organization_id", orgId)
          .limit(5000),
        supabase
          .from("products")
          .select("id, reorder_level, name, is_active")
          .eq("organization_id", orgId)
          .limit(2000),
        supabase
          .from("invoice_items")
          .select("product_id, quantity")
          .limit(5000),
        supabase.from("product_categories").select("id").eq("organization_id", orgId),
        supabase.from("sales_orders").select("status").eq("organization_id", orgId),
        supabase.from("bills").select("id, bill_date").eq("organization_id", orgId).gte("bill_date", startOfMonth).lte("bill_date", startOfToday),
        supabase.from("bill_items").select("bill_id, quantity"),
        supabase
          .from("purchase_orders")
          .select("id")
          .eq("organization_id", orgId)
          .in("status", ["draft", "sent", "partially_received"]),
        supabase.from("purchase_order_items").select("purchase_order_id, quantity"),
      ]);

      let todaySales = 0;
      let monthSales = 0;
      let yearSales = 0;
      let pendingInvoices = 0;
      let pendingPayments = 0;
      let paidCount = 0;
      const billIdsThisMonth = new Set((bills ?? []).map((b: { id: string }) => b.id));

      (invoices ?? []).forEach((invoice) => {
        const amount = Number(invoice.total_amount ?? 0);
        const date = (invoice.invoice_date ?? "").slice(0, 10);

        if (date >= startOfYear) yearSales += amount;
        if (date >= startOfMonth) monthSales += amount;
        if (date === startOfToday) todaySales += amount;

        if (
          invoice.status === "unpaid" ||
          invoice.status === "partially_paid"
        ) {
          pendingInvoices += 1;
          pendingPayments += amount;
        }
        if (invoice.status === "paid") paidCount += 1;
      });
      const unconfirmedCount = (salesOrders ?? []).filter((s: { status: string }) => s.status === "draft").length;

      let quantityInHand = 0;
      (ledger ?? []).forEach((entry) => {
        quantityInHand += Number(entry.qty_change ?? 0);
      });

      const openPoIds = new Set((purchaseOrders ?? []).map((p: { id: string }) => p.id));
      let quantityToBeReceived = 0;
      (poItems ?? []).forEach((row: { purchase_order_id: string; quantity: number }) => {
        if (openPoIds.has(row.purchase_order_id)) {
          quantityToBeReceived += Number(row.quantity ?? 0);
        }
      });

      let poQty = 0;
      (billItems ?? []).forEach((row: { bill_id: string; quantity: number }) => {
        if (billIdsThisMonth.has(row.bill_id)) {
          poQty += Number(row.quantity ?? 0);
        }
      });
      setPoQuantityOrdered(poQty);

      const soByStatus = { draft: 0, confirmed: 0, partially_fulfilled: 0, fulfilled: 0 };
      (salesOrders ?? []).forEach((so: { status: string }) => {
        if (so.status in soByStatus) (soByStatus as Record<string, number>)[so.status] += 1;
      });
      setSalesOrderRows([
        {
          channel: "Direct sales",
          draft: soByStatus.draft,
          confirmed: soByStatus.confirmed,
          packed: soByStatus.partially_fulfilled,
          shipped: soByStatus.fulfilled,
        },
      ]);

      let lowStockCount = 0;
      const productTotals = new Map<string, number>();
      (ledger ?? []).forEach((entry) => {
        const productId = (entry as { product_id?: string }).product_id;
        if (!productId) return;
        const current = productTotals.get(productId) ?? 0;
        productTotals.set(productId, current + Number(entry.qty_change ?? 0));
      });

      const productCount = products?.length ?? 0;
      let activeProductCount = 0;
      products?.forEach((product: { id: string; reorder_level?: number; is_active?: boolean }) => {
        const current = productTotals.get(product.id) ?? 0;
        const threshold = Number(product.reorder_level ?? 0);
        if (threshold > 0 && current <= threshold) lowStockCount += 1;
        if (product.is_active !== false) activeProductCount += 1;
      });
      if (productCount > 0 && activeProductCount === 0) activeProductCount = productCount;

      setSalesKpis({
        todaySales,
        monthSales,
        yearSales,
        pendingInvoices,
        pendingPayments,
        paidCount,
        totalInvoices: invoices?.length ?? 0,
        unconfirmedItems: unconfirmedCount,
      });
      setInventoryKpis({
        lowStockCount,
        quantityInHand,
        quantityToBeReceived,
        categoryCount: (categories ?? []).length,
        productCount,
        activeProductCount,
      });

      const salesByDayMap = new Map<string, number>();
      for (let d = 0; d < 30; d++) {
        const dte = new Date(today);
        dte.setDate(dte.getDate() - (29 - d));
        salesByDayMap.set(dte.toISOString().slice(0, 10), 0);
      }
      (invoices ?? []).forEach((inv) => {
        const date = (inv.invoice_date ?? "").slice(0, 10);
        if (date >= start30 && date <= startOfToday) {
          const amt = Number(inv.total_amount ?? 0);
          salesByDayMap.set(date, (salesByDayMap.get(date) ?? 0) + amt);
        }
      });
      const salesByDay = Array.from(salesByDayMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, amount]) => ({
          date,
          amount,
          label: new Date(date + "Z").toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
          }),
        }));

      const invoiceIds = (invoices ?? []).map((i: { id?: string }) => i.id).filter(Boolean) as string[];
      let itemsForTopProducts = invoiceItems ?? [];
      if (invoiceIds.length > 0) {
        const { data: orgInvoiceItems } = await supabase
          .from("invoice_items")
          .select("product_id, quantity")
          .in("invoice_id", invoiceIds);
        itemsForTopProducts = orgInvoiceItems ?? [];
      }

      const productQty = new Map<string, number>();
      const productNames = new Map<string, string>(
        (products ?? []).map((p: { id: string; name?: string }) => [p.id, p.name ?? "Unknown"])
      );
      itemsForTopProducts.forEach((row: { product_id: string; quantity: number }) => {
        const q = Number(row.quantity ?? 0);
        productQty.set(
          row.product_id,
          (productQty.get(row.product_id) ?? 0) + q
        );
      });
      const topProducts = Array.from(productQty.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([productId, quantity]) => ({
          name: productNames.get(productId) ?? "Unknown",
          quantity,
          productId,
        }));

      setChartData({ salesByDay, topProducts });
      setLoading(false);
    }

    fetchData();
  }, [router]);

  const hasAnyData =
    salesKpis.totalInvoices > 0 ||
    inventoryKpis.quantityInHand !== 0 ||
    inventoryKpis.lowStockCount > 0;

  const activePercent =
    inventoryKpis.productCount > 0
      ? Math.round((inventoryKpis.activeProductCount / inventoryKpis.productCount) * 100)
      : 0;

  return (
    <div className="min-h-full space-y-6 pb-8">
      {!hasAnyData && !loading && (
        <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50/50 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-amber-900">Get started</h2>
              <p className="mt-1 text-sm text-amber-800/90">
                Add customers, products, and your first invoice to see your dashboard come to life.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/sales/customers/new"
                  className="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700"
                >
                  + New customer
                </Link>
                <Link
                  href="/inventory/products/new"
                  className="inline-flex items-center rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50"
                >
                  + New product
                </Link>
                <Link
                  href="/sales/invoices/new"
                  className="inline-flex items-center rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50"
                >
                  + New invoice
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sales Activity */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Sales activity
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SalesActivityCard
            label="TO BE PACKED"
            value={0}
            sub="Qty"
            icon={<Package className="h-5 w-5" />}
            accent="slate"
            loading={loading}
          />
          <SalesActivityCard
            label="TO BE SHIPPED"
            value={0}
            sub="Pkgs"
            icon={<Clock className="h-5 w-5" />}
            accent="slate"
            loading={loading}
          />
          <SalesActivityCard
            label="TO BE DELIVERED"
            value={0}
            sub="Pkgs"
            icon={<MoreHorizontal className="h-5 w-5" />}
            accent="slate"
            loading={loading}
          />
          <SalesActivityCard
            label="TO BE INVOICED"
            value={salesKpis.pendingInvoices}
            sub="Qty"
            icon={<CheckCircle2 className="h-5 w-5" />}
            accent="emerald"
            loading={loading}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Inventory Summary */}
        <section className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm transition hover:shadow-md">
          <div className="border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
            <div className="flex items-center gap-2">
              <Boxes className="h-5 w-5 text-red-600" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
                Inventory summary
              </h2>
            </div>
          </div>
          <dl className="divide-y divide-neutral-100 px-6 py-4">
            <div className="flex items-center justify-between py-3 first:pt-0">
              <dt className="text-sm text-neutral-600">Quantity in hand</dt>
              <dd className="text-lg font-semibold tabular-nums text-neutral-900">
                {loading ? "—" : (inventoryKpis.quantityInHand ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </dd>
            </div>
            <div className="flex items-center justify-between py-3">
              <dt className="text-sm text-neutral-600">Quantity to be received</dt>
              <dd className="text-lg font-semibold tabular-nums text-neutral-900">
                {loading ? "—" : (inventoryKpis.quantityToBeReceived ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </dd>
            </div>
          </dl>
        </section>

        {/* Product Details */}
        <section className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm transition hover:shadow-md">
          <div className="border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-red-600" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
                Product details
              </h2>
            </div>
          </div>
          <div className="flex flex-wrap items-stretch gap-6 px-6 py-5">
            <dl className="flex-1 min-w-[180px] space-y-0 divide-y divide-neutral-100">
              <div className="flex items-center justify-between py-3 first:pt-0">
                <dt className="text-sm text-neutral-600">Low stock items</dt>
                <dd className={`font-semibold tabular-nums ${inventoryKpis.lowStockCount > 0 ? "text-red-600" : "text-neutral-900"}`}>
                  {loading ? "—" : inventoryKpis.lowStockCount}
                </dd>
              </div>
              <div className="flex items-center justify-between py-3">
                <dt className="text-sm text-neutral-600">All item group</dt>
                <dd className="font-semibold tabular-nums text-neutral-900">{loading ? "—" : inventoryKpis.categoryCount}</dd>
              </div>
              <div className="flex items-center justify-between py-3">
                <dt className="text-sm text-neutral-600">All items</dt>
                <dd className="font-semibold tabular-nums text-neutral-900">{loading ? "—" : inventoryKpis.productCount}</dd>
              </div>
              <div className="flex items-center justify-between py-3">
                <dt className="text-sm text-neutral-600">Unconfirmed items</dt>
                <dd className="flex items-center gap-1.5 font-semibold tabular-nums">
                  <span className={salesKpis.unconfirmedItems > 0 ? "text-red-600" : "text-neutral-900"}>
                    {loading ? "—" : salesKpis.unconfirmedItems}
                  </span>
                  {salesKpis.unconfirmedItems > 0 && <AlertCircle className="h-4 w-4 text-red-500" />}
                </dd>
              </div>
            </dl>
            <div className="flex flex-col items-center justify-center rounded-xl bg-neutral-50/80 px-6 py-4">
              <div className="relative h-28 w-28">
                <svg className="h-28 w-28 -rotate-90 text-neutral-200" viewBox="0 0 36 36">
                  <path
                    stroke="currentColor"
                    strokeWidth="2.5"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-red-500"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeDasharray={`${activePercent}, 100`}
                    strokeLinecap="round"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-neutral-900">
                  {loading ? "—" : `${activePercent}%`}
                </span>
              </div>
              <span className="mt-2 text-xs font-medium text-neutral-500">Active items</span>
            </div>
          </div>
        </section>
      </div>

      {/* Top Selling Items */}
      <section className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm transition hover:shadow-md">
        <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
              Top selling items
            </h2>
          </div>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">Previous year</span>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 w-40 animate-pulse rounded-xl bg-neutral-100" />
              ))}
            </div>
          ) : chartData.topProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-200/80 text-neutral-400">
                <ImageIcon className="h-7 w-7" />
              </div>
              <p className="mt-3 text-sm font-medium text-neutral-600">No sales data yet</p>
              <p className="mt-1 max-w-xs text-xs text-neutral-500">
                Create invoices to see your top selling products here.
              </p>
              <Link
                href="/sales/invoices/new"
                className="mt-4 inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Create invoice
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {chartData.topProducts.map((item, i) => (
                <Link
                  key={i}
                  href={`/inventory/products/${item.productId}`}
                  className="group flex w-40 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition hover:border-red-200 hover:shadow-md"
                >
                  <div className="flex h-24 items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 group-hover:from-red-50/50 group-hover:to-neutral-100">
                    <ImageIcon className="h-10 w-10 text-neutral-400 group-hover:text-red-400/80" />
                  </div>
                  <div className="border-t border-neutral-100 p-3">
                    <p className="truncate text-sm font-medium text-neutral-900" title={item.name}>
                      {item.name}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-red-600">{item.quantity} sold</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Sales trend */}
      {chartData.salesByDay.some((d) => d.amount > 0) && !loading && (
        <section className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm transition hover:shadow-md">
          <div className="border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
              Sales trend (last 30 days)
            </h2>
          </div>
          <div className="p-6 pt-4">
            <div className="h-56 min-h-[14rem] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.salesByDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dc2626" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#737373" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#737373" tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
                  <Tooltip
                    formatter={(v: number | undefined) => [v != null ? `₹${v.toLocaleString("en-IN")}` : "—", "Sales"]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.date}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#dc2626" strokeWidth={2} fill="url(#salesGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Purchase Order */}
        <section className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between border-b border-neutral-100 bg-red-50/50 px-6 py-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-red-600" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
                Purchase order
              </h2>
            </div>
            <div className="relative">
              <select
                value={poPeriod}
                onChange={(e) => setPoPeriod(e.target.value as "This Month" | "Last Month")}
                className="w-full min-w-[120px] appearance-none rounded-xl border border-neutral-200 bg-white py-2.5 pl-3.5 pr-9 text-sm font-medium text-neutral-800 shadow-sm transition focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              >
                <option>This Month</option>
                <option>Last Month</option>
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </span>
            </div>
          </div>
          <div className="px-6 py-6">
            <p className="text-4xl font-bold tabular-nums text-red-600">
              {loading ? "—" : poQuantityOrdered.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-sm text-neutral-500">Quantity ordered</p>
          </div>
        </section>

        {/* Sales Order */}
        <section className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm transition hover:shadow-md">
          <div className="border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-neutral-500" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
                Sales order
              </h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <th className="px-6 py-3">Channel</th>
                  <th className="px-6 py-3 text-right">Draft</th>
                  <th className="px-6 py-3 text-right">Confirmed</th>
                  <th className="px-6 py-3 text-right">Packed</th>
                  <th className="px-6 py-3 text-right">Shipped</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-neutral-400">Loading…</td>
                  </tr>
                ) : salesOrderRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">No sales orders</td>
                  </tr>
                ) : (
                  salesOrderRows.map((row, i) => (
                    <tr key={i} className="transition hover:bg-neutral-50/50">
                      <td className="px-6 py-3 font-medium text-neutral-900">{row.channel}</td>
                      <td className="px-6 py-3 text-right tabular-nums text-neutral-700">{row.draft}</td>
                      <td className="px-6 py-3 text-right tabular-nums text-neutral-700">{row.confirmed}</td>
                      <td className="px-6 py-3 text-right tabular-nums text-neutral-700">{row.packed}</td>
                      <td className="px-6 py-3 text-right tabular-nums text-neutral-700">{row.shipped}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function SalesActivityCard({
  label,
  value,
  sub,
  icon,
  accent,
  loading,
}: {
  label: string;
  value: number;
  sub: string;
  icon: React.ReactNode;
  accent: "slate" | "emerald";
  loading: boolean;
}) {
  const iconBg = accent === "emerald" ? "bg-emerald-100 text-emerald-600" : "bg-neutral-100 text-neutral-500";
  return (
    <div className="flex items-center justify-between rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div>
        <p className="text-2xl font-bold tabular-nums text-neutral-900">
          {loading ? "—" : value} <span className="text-sm font-normal text-neutral-500">{sub}</span>
        </p>
        <p className="mt-1 text-xs font-medium text-neutral-500">{label}</p>
      </div>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
        {icon}
      </div>
    </div>
  );
}
