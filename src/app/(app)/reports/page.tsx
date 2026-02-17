"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentOrganizationId } from "@/lib/currentOrganization";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  TrendingUp,
  ShoppingCart,
  FileText,
  Package,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
} from "lucide-react";

type Money = number;

type ReportsState = {
  salesTotal: Money;
  purchaseTotal: Money;
  gstOutput: Money;
  gstInput: Money;
  stockQuantity: number;
  invoiceCount: number;
  paidCount: number;
  unpaidCount: number;
  partiallyPaidCount: number;
};

type ChartPoint = { date: string; sales: number; purchases: number; label: string };
type StatusItem = { name: string; value: number; color: string };
type TopProduct = { name: string; quantity: number; revenue: number };

const STATUS_COLORS = ["#22c55e", "#eab308", "#ef4444"]; // paid, partially_paid, unpaid

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportsState>({
    salesTotal: 0,
    purchaseTotal: 0,
    gstOutput: 0,
    gstInput: 0,
    stockQuantity: 0,
    invoiceCount: 0,
    paidCount: 0,
    unpaidCount: 0,
    partiallyPaidCount: 0,
  });
  const [salesByDay, setSalesByDay] = useState<ChartPoint[]>([]);
  const [purchasesByDay, setPurchasesByDay] = useState<ChartPoint[]>([]);
  const [statusData, setStatusData] = useState<StatusItem[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);

  useEffect(() => {
    async function loadReports() {
      const orgId = await getCurrentOrganizationId();
      if (!orgId) {
        setLoading(false);
        return;
      }

      const today = new Date();
      const start30 = new Date(today);
      start30.setDate(start30.getDate() - 30);
      const start30Str = start30.toISOString().slice(0, 10);
      const todayStr = today.toISOString().slice(0, 10);

      const [
        { data: invoices },
        { data: bills },
        { data: ledger },
        { data: products },
      ] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, total_amount, total_tax, invoice_date, status")
          .eq("organization_id", orgId),
        supabase
          .from("bills")
          .select("total_amount, total_tax, bill_date")
          .eq("organization_id", orgId),
        supabase.from("stock_ledger").select("qty_change").eq("organization_id", orgId),
        supabase.from("products").select("id, name").eq("organization_id", orgId),
      ]);

      const invoiceIds = (invoices ?? []).map((i: { id?: string }) => i.id).filter(Boolean) as string[];
      let invoiceItems: { product_id: string; quantity: number; line_total?: number }[] = [];
      if (invoiceIds.length > 0) {
        const { data: items } = await supabase
          .from("invoice_items")
          .select("product_id, quantity, line_total")
          .in("invoice_id", invoiceIds);
        invoiceItems = items ?? [];
      }

      let salesTotal = 0,
        gstOutput = 0,
        paidCount = 0,
        unpaidCount = 0,
        partiallyPaidCount = 0;
      const salesByDate = new Map<string, number>();
      (invoices ?? []).forEach((inv: { total_amount?: number; total_tax?: number; invoice_date?: string; status?: string }) => {
        const amt = Number(inv.total_amount ?? 0);
        const tax = Number(inv.total_tax ?? 0);
        salesTotal += amt;
        gstOutput += tax;
        if (inv.status === "paid") paidCount++;
        else if (inv.status === "partially_paid") partiallyPaidCount++;
        else if (inv.status === "unpaid" || inv.status === "overdue") unpaidCount++;
        const d = (inv.invoice_date ?? "").slice(0, 10);
        if (d >= start30Str && d <= todayStr) salesByDate.set(d, (salesByDate.get(d) ?? 0) + amt);
      });

      let purchaseTotal = 0, gstInput = 0;
      const purchasesByDate = new Map<string, number>();
      (bills ?? []).forEach((bill: { total_amount?: number; total_tax?: number; bill_date?: string }) => {
        const amt = Number(bill.total_amount ?? 0);
        const tax = Number(bill.total_tax ?? 0);
        purchaseTotal += amt;
        gstInput += tax;
        const d = (bill.bill_date ?? "").slice(0, 10);
        if (d >= start30Str && d <= todayStr) purchasesByDate.set(d, (purchasesByDate.get(d) ?? 0) + amt);
      });

      let stockQuantity = 0;
      (ledger ?? []).forEach((e: { qty_change?: number }) => {
        stockQuantity += Number(e.qty_change ?? 0);
      });

      const productNames = new Map<string, string>(
        (products ?? []).map((p: { id: string; name?: string }) => [p.id, p.name ?? "Unknown"])
      );
      const productQty = new Map<string, { quantity: number; revenue: number }>();
      (invoiceItems ?? []).forEach((row: { product_id: string; quantity: number; line_total?: number }) => {
        const id = row.product_id;
        const cur = productQty.get(id) ?? { quantity: 0, revenue: 0 };
        cur.quantity += Number(row.quantity ?? 0);
        cur.revenue += Number((row as { line_total?: number }).line_total ?? 0);
        productQty.set(id, cur);
      });
      const topProductsList = Array.from(productQty.entries())
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 6)
        .map(([id, v]) => ({
          name: productNames.get(id) ?? "Unknown",
          quantity: v.quantity,
          revenue: v.revenue,
        }));
      setTopProducts(topProductsList);

      const statusItems: StatusItem[] = [];
      if (paidCount > 0) statusItems.push({ name: "Paid", value: paidCount, color: STATUS_COLORS[0] });
      if (partiallyPaidCount > 0) statusItems.push({ name: "Partially paid", value: partiallyPaidCount, color: STATUS_COLORS[1] });
      if (unpaidCount > 0) statusItems.push({ name: "Unpaid", value: unpaidCount, color: STATUS_COLORS[2] });
      if (statusItems.length === 0) statusItems.push({ name: "No invoices", value: 1, color: "#94a3b8" });
      setStatusData(statusItems);

      const dayMap = new Map<string, { sales: number; purchases: number }>();
      for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - (29 - i));
        const key = d.toISOString().slice(0, 10);
        dayMap.set(key, {
          sales: salesByDate.get(key) ?? 0,
          purchases: purchasesByDate.get(key) ?? 0,
        });
      }
      const combined = Array.from(dayMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, v]) => ({
          date,
          sales: v.sales,
          purchases: v.purchases,
          label: new Date(date + "Z").toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        }));
      setSalesByDay(combined);

      setReports({
        salesTotal,
        purchaseTotal,
        gstOutput,
        gstInput,
        stockQuantity,
        invoiceCount: invoices?.length ?? 0,
        paidCount,
        unpaidCount,
        partiallyPaidCount,
      });
      setLoading(false);
    }

    loadReports();
  }, []);

  const gstNet = reports.gstOutput - reports.gstInput;
  const profitMargin = reports.salesTotal > 0
    ? ((reports.salesTotal - reports.purchaseTotal) / reports.salesTotal * 100).toFixed(1)
    : "—";

  return (
    <div className="space-y-6 pb-8">
      <header>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">
              Reports & insights
            </h1>
            <p className="text-sm text-neutral-500">
              Sales, purchases, GST, and stock metrics at a glance.
            </p>
          </div>
        </div>
      </header>

      {/* KPI cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Total sales"
          value={reports.salesTotal}
          loading={loading}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="emerald"
        />
        <KpiCard
          title="Total purchases"
          value={reports.purchaseTotal}
          loading={loading}
          icon={<ShoppingCart className="h-5 w-5" />}
          accent="blue"
        />
        <KpiCard
          title="GST output"
          value={reports.gstOutput}
          loading={loading}
          icon={<ArrowUpRight className="h-5 w-5" />}
          accent="amber"
        />
        <KpiCard
          title="GST input"
          value={reports.gstInput}
          loading={loading}
          icon={<ArrowDownRight className="h-5 w-5" />}
          accent="violet"
        />
      </section>

      {/* Sales & purchases trend */}
      <section className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm transition hover:shadow-md">
        <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
          <TrendingUp className="h-5 w-5 text-red-600" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
            Sales & purchases (last 30 days)
          </h2>
        </div>
        <div className="p-6">
          <div className="h-72 min-h-[18rem] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesByDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="purchasesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#737373" />
                <YAxis tick={{ fontSize: 11 }} stroke="#737373" tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
                <Tooltip
                  formatter={(v: number | undefined) => [v != null ? `₹${Number(v).toLocaleString("en-IN")}` : "—", ""]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.date}
                />
                <Area type="monotone" dataKey="sales" name="Sales" stroke="#dc2626" strokeWidth={2} fill="url(#salesFill)" />
                <Area type="monotone" dataKey="purchases" name="Purchases" stroke="#2563eb" strokeWidth={2} fill="url(#purchasesFill)" />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Invoice status */}
        <section className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm transition hover:shadow-md">
          <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
            <PieChartIcon className="h-5 w-5 text-neutral-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
              Invoice status
            </h2>
          </div>
          <div className="flex flex-col items-center justify-center p-6 sm:flex-row sm:gap-8">
            <div className="h-52 min-h-[13rem] w-52 min-w-[13rem] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={80}
                    paddingAngle={2}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={statusData[i].color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number | undefined) => [v ?? 0, "Invoices"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-4 sm:mt-0">
              {statusData.map((item, i) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-neutral-700">{item.name}</span>
                  <span className="font-semibold tabular-nums text-neutral-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* GST & margins insight */}
        <section className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm transition hover:shadow-md">
          <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
            <FileText className="h-5 w-5 text-amber-600" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
              GST & margin insight
            </h2>
          </div>
          <div className="space-y-4 p-6">
            <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50/50 px-4 py-3">
              <span className="text-sm text-neutral-600">Net GST (output − input)</span>
              <span className={`font-semibold tabular-nums ${gstNet >= 0 ? "text-amber-600" : "text-red-600"}`}>
                {loading ? "—" : `₹${gstNet.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50/50 px-4 py-3">
              <span className="text-sm text-neutral-600">Gross margin (approx)</span>
              <span className="font-semibold tabular-nums text-neutral-900">
                {loading ? "—" : `${profitMargin}%`}
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              Margin = (Sales − Purchases) / Sales. Net GST is payable when output exceeds input.
            </p>
          </div>
        </section>
      </div>

      {/* Top products by revenue */}
      <section className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm transition hover:shadow-md">
        <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
          <Package className="h-5 w-5 text-red-600" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
            Top products by revenue
          </h2>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="h-48 animate-pulse rounded-lg bg-neutral-100" />
          ) : topProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">No sales data yet.</p>
          ) : (
            <div className="h-64 min-h-[16rem] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical" margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="#737373" tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} stroke="#737373" />
                  <Tooltip formatter={(v: number | undefined) => [`₹${(v ?? 0).toLocaleString("en-IN")}`, "Revenue"]} />
                  <Bar dataKey="revenue" fill="#dc2626" radius={[0, 4, 4, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* Stock summary */}
      <section className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm transition hover:shadow-md">
        <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
          <Package className="h-5 w-5 text-neutral-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
            Stock summary
          </h2>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="text-sm text-neutral-500">
              Total quantity across all warehouses (from stock ledger).
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-neutral-900">
              {loading ? "—" : reports.stockQuantity.toLocaleString("en-IN", { maximumFractionDigits: 2 })} units
            </p>
          </div>
          <div className="rounded-xl bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-600">
            {reports.invoiceCount} invoices · {reports.paidCount} paid
          </div>
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  title,
  value,
  loading,
  icon,
  accent,
}: {
  title: string;
  value: Money;
  loading: boolean;
  icon: React.ReactNode;
  accent: "emerald" | "blue" | "amber" | "violet";
}) {
  const styles: Record<typeof accent, string> = {
    emerald: "bg-emerald-100 text-emerald-600",
    blue: "bg-red-100 text-red-600",
    amber: "bg-amber-100 text-amber-600",
    violet: "bg-violet-100 text-violet-600",
  };
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-900">
            {loading ? "—" : `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          </p>
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${styles[accent]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
