import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

/**
 * Simple seed script to create rich dummy data for a single organization.
 *
 * Usage:
 *   1. Ensure you have at least one organization and are an admin in it.
 *   2. In Supabase -> Project Settings -> API, copy:
 *        - Project URL
 *        - service_role key (never expose this key in the browser)
 *   3. In this repo, create a .env.local with:
 *        NEXT_PUBLIC_SUPABASE_URL=...your project url...
 *        SUPABASE_SERVICE_ROLE_KEY=...your service role key...
 *   4. Run:
 *        node scripts/seed-dummy-data.mjs
 *
 * The script will:
 *   - Pick the first organization it finds
 *   - Pick the first admin user for that org
 *   - Insert warehouses, product categories, products
 *   - Insert customers, vendors
 *   - Insert a few invoices + invoice_items
 *   - Insert a few bills + bill_items
 *   - Insert basic stock_ledger rows so inventory widgets look busy
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

async function getTargetOrgAndUser() {
  const { data: orgUsers, error } = await supabase
    .from("organization_users")
    .select("organization_id, user_id, role")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error || !orgUsers?.length) {
    throw new Error("No organization_users found. Create an organization via the app first.");
  }

  const { organization_id, user_id } = orgUsers[0];

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", organization_id)
    .single();

  if (orgError || !org) {
    throw new Error("Unable to load organization for seeding.");
  }

  return { orgId: org.id, userId: user_id, orgName: org.name };
}

async function seed() {
  const { orgId, userId, orgName } = await getTargetOrgAndUser();
  console.log(`Seeding dummy data for organization: ${orgName} (${orgId})`);

  // Warehouses
  const { data: warehouses, error: whError } = await supabase
    .from("warehouses")
    .insert([
      {
        organization_id: orgId,
        name: "Online Warehouse",
        code: "ONLINE",
        is_default: false,
      },
      {
        organization_id: orgId,
        name: "Outlet Store",
        code: "OUTLET",
        is_default: false,
      },
    ])
    .select("id");
  if (whError) throw whError;

  const { data: defaultWh } = await supabase
    .from("warehouses")
    .select("id")
    .eq("organization_id", orgId)
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();

  const warehouseIds = [
    defaultWh?.id,
    ...(warehouses ?? []).map((w) => w.id),
  ].filter(Boolean);

  // Product categories
  const { data: categories, error: catError } = await supabase
    .from("product_categories")
    .insert([
      { organization_id: orgId, name: "Electronics" },
      { organization_id: orgId, name: "Accessories" },
    ])
    .select("id, name");
  if (catError) throw catError;

  const electronicsId = categories?.find((c) => c.name === "Electronics")?.id;
  const accessoriesId = categories?.find((c) => c.name === "Accessories")?.id;

  // Products
  const { data: products, error: prodError } = await supabase
    .from("products")
    .insert([
      {
        organization_id: orgId,
        name: "Wireless Mouse",
        sku: "MOUSE-001",
        tax_rate: 18,
        uom: "pcs",
        category_id: accessoriesId ?? null,
        sales_price: 899,
        purchase_price: 500,
        reorder_level: 10,
      },
      {
        organization_id: orgId,
        name: "Mechanical Keyboard",
        sku: "KEYB-001",
        tax_rate: 18,
        uom: "pcs",
        category_id: accessoriesId ?? null,
        sales_price: 2999,
        purchase_price: 1800,
        reorder_level: 5,
      },
      {
        organization_id: orgId,
        name: "27\" Monitor",
        sku: "MON-027",
        tax_rate: 18,
        uom: "pcs",
        category_id: electronicsId ?? null,
        sales_price: 12999,
        purchase_price: 9000,
        reorder_level: 3,
      },
    ])
    .select("id, name, sales_price, tax_rate");
  if (prodError) throw prodError;

  // Customers
  const { data: customers, error: custError } = await supabase
    .from("customers")
    .insert([
      {
        organization_id: orgId,
        name: "Acme Retailers",
        email: "buyer@acmeretail.com",
        phone: "+91-9876543210",
        gstin: "27ABCDE1234F1Z5",
        billing_address: { line1: "MG Road", city: "Pune", state: "MH" },
      },
      {
        organization_id: orgId,
        name: "Tech Hub Pvt Ltd",
        email: "accounts@techhub.in",
        phone: "+91-9000012345",
        gstin: "27ABCDE5678F1Z9",
        billing_address: { line1: "Koramangala", city: "Bengaluru", state: "KA" },
      },
    ])
    .select("id, name");
  if (custError) throw custError;

  // Vendors
  const { data: vendors, error: vendError } = await supabase
    .from("vendors")
    .insert([
      {
        organization_id: orgId,
        name: "Global Distributors",
        email: "sales@globaldist.com",
        phone: "+91-9998877766",
        gstin: "27GLOB1234F1Z5",
        address: { line1: "Andheri East", city: "Mumbai", state: "MH" },
      },
      {
        organization_id: orgId,
        name: "Peripheral World",
        email: "orders@peripheralworld.in",
        phone: "+91-8887766655",
        gstin: "27PERI5678F1Z9",
        address: { line1: "Salt Lake", city: "Kolkata", state: "WB" },
      },
    ])
    .select("id, name");
  if (vendError) throw vendError;

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const c1 = customers?.[0];
  const c2 = customers?.[1];
  const v1 = vendors?.[0];
  const v2 = vendors?.[1];

  const p1 = products?.[0];
  const p2 = products?.[1];
  const p3 = products?.[2];

  // Helper to build invoice numbers like INV-1001, INV-1002
  function invNo(n) {
    return `INV-${1000 + n}`;
  }
  function billNo(n) {
    return `BILL-${2000 + n}`;
  }

  // Invoices
  const invoicePayload = [
    {
      customer: c1,
      number: invNo(1),
      status: "paid",
      lines: [
        { product: p1, qty: 10 },
        { product: p2, qty: 5 },
      ],
    },
    {
      customer: c2,
      number: invNo(2),
      status: "unpaid",
      lines: [
        { product: p3, qty: 2 },
        { product: p1, qty: 4 },
      ],
    },
  ];

  const createdInvoices = [];

  for (const inv of invoicePayload) {
    let subtotal = 0;
    let cgst = 0;
    let sgst = 0;

    const enriched = inv.lines.map((l) => {
      const price = l.product.sales_price ?? 0;
      const qty = l.qty;
      const lineSubtotal = price * qty;
      const rate = l.product.tax_rate ?? 0;
      const taxAmount = (lineSubtotal * rate) / 100;
      const half = taxAmount / 2;
      subtotal += lineSubtotal;
      cgst += half;
      sgst += half;
      return { ...l, price, lineSubtotal, rate, cgstAmount: half, sgstAmount: half };
    });

    const totalTax = cgst + sgst;
    const totalAmount = subtotal + totalTax;

    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .insert({
        organization_id: orgId,
        invoice_number: inv.number,
        customer_id: inv.customer.id,
        invoice_date: todayStr,
        status: inv.status,
        currency: "INR",
        subtotal,
        cgst_amount: cgst,
        sgst_amount: sgst,
        igst_amount: 0,
        total_tax: totalTax,
        total_amount: totalAmount,
        created_by: userId,
      })
      .select("id")
      .single();
    if (invError || !invoice) throw invError || new Error("Unable to insert invoice");

    const items = enriched.map((line) => ({
      invoice_id: invoice.id,
      product_id: line.product.id,
      description: line.product.name,
      quantity: line.qty,
      unit_price: line.price,
      discount_percent: 0,
      tax_rate: line.rate,
      cgst_amount: line.cgstAmount,
      sgst_amount: line.sgstAmount,
      igst_amount: 0,
      line_total: line.lineSubtotal + line.cgstAmount + line.sgstAmount,
    }));

    const { error: itemsError } = await supabase
      .from("invoice_items")
      .insert(items);
    if (itemsError) throw itemsError;

    createdInvoices.push({ id: invoice.id, totalAmount });
  }

  // Bills
  const billPayload = [
    {
      vendor: v1,
      number: billNo(1),
      status: "unpaid",
      lines: [
        { product: p1, qty: 30, price: 480 },
        { product: p2, qty: 10, price: 1700 },
      ],
    },
    {
      vendor: v2,
      number: billNo(2),
      status: "paid",
      lines: [
        { product: p3, qty: 5, price: 8800 },
      ],
    },
  ];

  for (const bill of billPayload) {
    let subtotal = 0;
    let cgst = 0;
    let sgst = 0;

    const enriched = bill.lines.map((l) => {
      const qty = l.qty;
      const price = l.price;
      const lineSubtotal = qty * price;
      const rate = l.product.tax_rate ?? 0;
      const taxAmount = (lineSubtotal * rate) / 100;
      const half = taxAmount / 2;
      subtotal += lineSubtotal;
      cgst += half;
      sgst += half;
      return { ...l, lineSubtotal, rate, cgstAmount: half, sgstAmount: half };
    });

    const totalTax = cgst + sgst;
    const totalAmount = subtotal + totalTax;

    const { data: billRow, error: billError } = await supabase
      .from("bills")
      .insert({
        organization_id: orgId,
        bill_number: bill.number,
        vendor_id: bill.vendor.id,
        bill_date: todayStr,
        status: bill.status,
        currency: "INR",
        subtotal,
        cgst_amount: cgst,
        sgst_amount: sgst,
        igst_amount: 0,
        total_tax: totalTax,
        total_amount: totalAmount,
        created_by: userId,
      })
      .select("id")
      .single();
    if (billError || !billRow) throw billError || new Error("Unable to insert bill");

    const items = enriched.map((line) => ({
      bill_id: billRow.id,
      product_id: line.product.id,
      description: line.product.name,
      quantity: line.qty,
      unit_price: line.price,
      discount_percent: 0,
      tax_rate: line.rate,
      cgst_amount: line.cgstAmount,
      sgst_amount: line.sgstAmount,
      igst_amount: 0,
      line_total: line.lineSubtotal + line.cgstAmount + line.sgstAmount,
    }));

    const { error: itemsError } = await supabase.from("bill_items").insert(items);
    if (itemsError) throw itemsError;
  }

  // Basic stock ledger entries (opening balances)
  const stockEntries = [];
  for (const product of products ?? []) {
    for (const whId of warehouseIds) {
      stockEntries.push({
        organization_id: orgId,
        product_id: product.id,
        warehouse_id: whId,
        qty_change: 50,
        unit_cost: product.sales_price ?? 0,
        reference_type: "opening_balance",
        created_by: userId,
        notes: "Seed data opening balance",
      });
    }
  }
  if (stockEntries.length) {
    const { error: stockError } = await supabase.from("stock_ledger").insert(stockEntries);
    if (stockError) throw stockError;
  }

  console.log("Seed complete. Dummy data has been inserted.");
}

seed()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

