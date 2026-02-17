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

const TARGET_ORG_NAME = "Bacancy";

async function getTargetOrgAndUser() {
  // Prefer organization named "Bacancy"; fall back to first org
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name")
    .ilike("name", TARGET_ORG_NAME)
    .limit(1)
    .maybeSingle();

  let orgId = org?.id;
  let orgName = org?.name;

  if (orgError || !org) {
    const { data: firstOrg, error: firstError } = await supabase
      .from("organizations")
      .select("id, name")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstError || !firstOrg) {
      throw new Error(
        "No organizations found. Create an organization (e.g. \"Bacancy\") via the app first."
      );
    }
    orgId = firstOrg.id;
    orgName = firstOrg.name;
  }

  const { data: orgUsers, error } = await supabase
    .from("organization_users")
    .select("organization_id, user_id, role")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error || !orgUsers?.length) {
    throw new Error(
      `No active admin/member for organization "${orgName}". Add yourself to the org in the app first.`
    );
  }

  const { user_id } = orgUsers[0];
  return { orgId, userId: user_id, orgName };
}

async function seed() {
  const { orgId, userId, orgName } = await getTargetOrgAndUser();
  console.log(`Seeding dummy data for organization: ${orgName} (${orgId})`);

  // Warehouses (skip codes that already exist so script is re-runnable)
  const wantedWarehouses = [
    { organization_id: orgId, name: "Online Warehouse", code: "ONLINE", is_default: false },
    { organization_id: orgId, name: "Outlet Store", code: "OUTLET", is_default: false },
    { organization_id: orgId, name: "Retail Store", code: "RETAIL", is_default: false },
    { organization_id: orgId, name: "Distribution Center", code: "DC-01", is_default: false },
  ];
  const { data: existingWarehouses } = await supabase
    .from("warehouses")
    .select("id, code")
    .eq("organization_id", orgId);
  const existingCodes = new Set((existingWarehouses ?? []).map((w) => w.code).filter(Boolean));
  const toInsert = wantedWarehouses.filter((w) => !existingCodes.has(w.code));
  if (toInsert.length > 0) {
    const { error: whError } = await supabase.from("warehouses").insert(toInsert).select("id");
    if (whError) throw whError;
  }
  const { data: allWarehouses } = await supabase
    .from("warehouses")
    .select("id")
    .eq("organization_id", orgId);
  const warehouseIds = (allWarehouses ?? []).map((w) => w.id).filter(Boolean);

  // Product categories (skip names that already exist)
  const wantedCategories = [
    { organization_id: orgId, name: "Electronics" },
    { organization_id: orgId, name: "Accessories" },
    { organization_id: orgId, name: "Office Supplies" },
    { organization_id: orgId, name: "Furniture" },
    { organization_id: orgId, name: "Consumables" },
  ];
  const { data: existingCategories } = await supabase
    .from("product_categories")
    .select("id, name")
    .eq("organization_id", orgId);
  const existingCategoryNames = new Set((existingCategories ?? []).map((c) => c.name));
  const categoriesToInsert = wantedCategories.filter((c) => !existingCategoryNames.has(c.name));
  if (categoriesToInsert.length > 0) {
    const { error: catError } = await supabase.from("product_categories").insert(categoriesToInsert);
    if (catError) throw catError;
  }
  const { data: categories } = await supabase
    .from("product_categories")
    .select("id, name")
    .eq("organization_id", orgId);
  const cat = (name) => categories?.find((c) => c.name === name)?.id ?? null;

  // Products (skip SKUs that already exist)
  const wantedProducts = [
    { organization_id: orgId, name: "Wireless Mouse", sku: "MOUSE-001", tax_rate: 18, uom: "pcs", category_id: cat("Accessories"), sales_price: 899, purchase_price: 500, reorder_level: 10 },
    { organization_id: orgId, name: "Mechanical Keyboard", sku: "KEYB-001", tax_rate: 18, uom: "pcs", category_id: cat("Accessories"), sales_price: 2999, purchase_price: 1800, reorder_level: 5 },
    { organization_id: orgId, name: "27\" Monitor", sku: "MON-027", tax_rate: 18, uom: "pcs", category_id: cat("Electronics"), sales_price: 12999, purchase_price: 9000, reorder_level: 3 },
    { organization_id: orgId, name: "USB-C Hub", sku: "HUB-001", tax_rate: 18, uom: "pcs", category_id: cat("Electronics"), sales_price: 2499, purchase_price: 1400, reorder_level: 15 },
    { organization_id: orgId, name: "Laptop Stand", sku: "STAND-01", tax_rate: 18, uom: "pcs", category_id: cat("Accessories"), sales_price: 1599, purchase_price: 800, reorder_level: 20 },
    { organization_id: orgId, name: "Webcam HD", sku: "WEBCAM-01", tax_rate: 18, uom: "pcs", category_id: cat("Electronics"), sales_price: 3499, purchase_price: 2100, reorder_level: 8 },
    { organization_id: orgId, name: "A4 Paper Ream", sku: "PAPER-A4", tax_rate: 12, uom: "ream", category_id: cat("Office Supplies"), sales_price: 299, purchase_price: 180, reorder_level: 50 },
    { organization_id: orgId, name: "Desk Lamp LED", sku: "LAMP-01", tax_rate: 18, uom: "pcs", category_id: cat("Furniture"), sales_price: 899, purchase_price: 450, reorder_level: 12 },
    { organization_id: orgId, name: "Stapler Heavy Duty", sku: "STAP-01", tax_rate: 12, uom: "pcs", category_id: cat("Office Supplies"), sales_price: 249, purchase_price: 120, reorder_level: 30 },
    { organization_id: orgId, name: "Whiteboard Marker Set", sku: "MARKER-SET", tax_rate: 12, uom: "set", category_id: cat("Consumables"), sales_price: 199, purchase_price: 95, reorder_level: 40 },
  ];
  const { data: existingProducts } = await supabase
    .from("products")
    .select("id, sku")
    .eq("organization_id", orgId);
  const existingSkus = new Set((existingProducts ?? []).map((p) => p.sku).filter(Boolean));
  const productsToInsert = wantedProducts.filter((p) => !existingSkus.has(p.sku));
  if (productsToInsert.length > 0) {
    const { error: prodError } = await supabase.from("products").insert(productsToInsert);
    if (prodError) throw prodError;
  }
  const skuOrder = ["MOUSE-001", "KEYB-001", "MON-027", "HUB-001", "STAND-01", "WEBCAM-01", "PAPER-A4", "LAMP-01", "STAP-01", "MARKER-SET"];
  const { data: productsRaw } = await supabase
    .from("products")
    .select("id, name, sales_price, tax_rate, sku")
    .eq("organization_id", orgId);
  const products = (productsRaw ?? []).sort(
    (a, b) => skuOrder.indexOf(a.sku) - skuOrder.indexOf(b.sku)
  );

  // Customers (skip emails that already exist)
  const wantedCustomers = [
    { organization_id: orgId, name: "Acme Retailers", email: "buyer@acmeretail.com", phone: "+91-9876543210", gstin: "27ABCDE1234F1Z5", billing_address: { line1: "MG Road", city: "Pune", state: "MH" } },
    { organization_id: orgId, name: "Tech Hub Pvt Ltd", email: "accounts@techhub.in", phone: "+91-9000012345", gstin: "27ABCDE5678F1Z9", billing_address: { line1: "Koramangala", city: "Bengaluru", state: "KA" } },
    { organization_id: orgId, name: "Startup Labs Inc", email: "procurement@startuplabs.io", phone: "+91-9123456789", gstin: "29START1234F1Z5", billing_address: { line1: "HSR Layout", city: "Bengaluru", state: "KA" } },
    { organization_id: orgId, name: "Metro Stores Ltd", email: "orders@metrostores.in", phone: "+91-9876123456", gstin: "07METRO5678F1Z9", billing_address: { line1: "Connaught Place", city: "New Delhi", state: "DL" } },
    { organization_id: orgId, name: "Coastal Traders", email: "billing@coastaltraders.com", phone: "+91-8765432109", gstin: "33COAST1234F1Z5", billing_address: { line1: "Anna Salai", city: "Chennai", state: "TN" } },
    { organization_id: orgId, name: "Cloud Nine Solutions", email: "finance@cloudnine.co", phone: "+91-9988776655", gstin: "27CLOUD9876F1Z5", billing_address: { line1: "Banjara Hills", city: "Hyderabad", state: "TG" } },
  ];
  const { data: existingCust } = await supabase.from("customers").select("id, email").eq("organization_id", orgId);
  const existingCustEmails = new Set((existingCust ?? []).map((x) => x.email).filter(Boolean));
  const customersToInsert = wantedCustomers.filter((x) => !existingCustEmails.has(x.email));
  if (customersToInsert.length > 0) {
    const { error: custError } = await supabase.from("customers").insert(customersToInsert);
    if (custError) throw custError;
  }
  const customerOrder = wantedCustomers.map((x) => x.email);
  const { data: customersRaw } = await supabase.from("customers").select("id, name, email").eq("organization_id", orgId);
  const customers = (customersRaw ?? []).sort((a, b) => customerOrder.indexOf(a.email) - customerOrder.indexOf(b.email));

  // Vendors (skip emails that already exist)
  const wantedVendors = [
    { organization_id: orgId, name: "Global Distributors", email: "sales@globaldist.com", phone: "+91-9998877766", gstin: "27GLOB1234F1Z5", address: { line1: "Andheri East", city: "Mumbai", state: "MH" } },
    { organization_id: orgId, name: "Peripheral World", email: "orders@peripheralworld.in", phone: "+91-8887766655", gstin: "27PERI5678F1Z9", address: { line1: "Salt Lake", city: "Kolkata", state: "WB" } },
    { organization_id: orgId, name: "Office Depot India", email: "procurement@officedepot.in", phone: "+91-7776655443", gstin: "27OFFI3456F1Z5", address: { line1: "Bandra West", city: "Mumbai", state: "MH" } },
    { organization_id: orgId, name: "Tech Imports Co", email: "inquiry@techimports.co", phone: "+91-6665544332", gstin: "09TECHI7890F1Z5", address: { line1: "Nehru Place", city: "New Delhi", state: "DL" } },
    { organization_id: orgId, name: "Furniture Direct", email: "orders@furnituredirect.in", phone: "+91-5554433221", gstin: "33FURN1234F1Z5", address: { line1: "T Nagar", city: "Chennai", state: "TN" } },
  ];
  const { data: existingVend } = await supabase.from("vendors").select("id, email").eq("organization_id", orgId);
  const existingVendEmails = new Set((existingVend ?? []).map((x) => x.email).filter(Boolean));
  const vendorsToInsert = wantedVendors.filter((x) => !existingVendEmails.has(x.email));
  if (vendorsToInsert.length > 0) {
    const { error: vendError } = await supabase.from("vendors").insert(vendorsToInsert);
    if (vendError) throw vendError;
  }
  const vendorOrder = wantedVendors.map((x) => x.email);
  const { data: vendorsRaw } = await supabase.from("vendors").select("id, name, email").eq("organization_id", orgId);
  const vendors = (vendorsRaw ?? []).sort((a, b) => vendorOrder.indexOf(a.email) - vendorOrder.indexOf(b.email));

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;
  function dateStr(daysAgo) {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  }

  const c = (i) => customers?.[i];
  const v = (i) => vendors?.[i];
  const p = (i) => products?.[i];

  function invNo(n) {
    return `INV-${1000 + n}`;
  }
  function billNo(n) {
    return `BILL-${2000 + n}`;
  }

  // Invoices (skip invoice_numbers that already exist)
  const invoicePayloadAll = [
    { customer: c(0), number: invNo(1), status: "paid", date: dateStr(15), lines: [{ product: p(0), qty: 10 }, { product: p(1), qty: 5 }] },
    { customer: c(1), number: invNo(2), status: "unpaid", date: dateStr(5), lines: [{ product: p(2), qty: 2 }, { product: p(0), qty: 4 }] },
    { customer: c(2), number: invNo(3), status: "paid", date: dateStr(30), lines: [{ product: p(3), qty: 8 }, { product: p(4), qty: 12 }] },
    { customer: c(3), number: invNo(4), status: "unpaid", date: dateStr(2), lines: [{ product: p(5), qty: 3 }, { product: p(1), qty: 2 }] },
    { customer: c(4), number: invNo(5), status: "paid", date: dateStr(45), lines: [{ product: p(6), qty: 20 }, { product: p(8), qty: 15 }] },
    { customer: c(5), number: invNo(6), status: "unpaid", date: todayStr, lines: [{ product: p(7), qty: 5 }, { product: p(9), qty: 10 }] },
    { customer: c(0), number: invNo(7), status: "paid", date: dateStr(60), lines: [{ product: p(2), qty: 1 }, { product: p(3), qty: 4 }] },
    { customer: c(2), number: invNo(8), status: "unpaid", date: dateStr(1), lines: [{ product: p(0), qty: 25 }, { product: p(4), qty: 6 }] },
  ];
  const { data: existingInvs } = await supabase.from("invoices").select("invoice_number").eq("organization_id", orgId);
  const existingInvNumbers = new Set((existingInvs ?? []).map((x) => x.invoice_number));
  const invoicePayload = invoicePayloadAll.filter((inv) => !existingInvNumbers.has(inv.number));

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
        invoice_date: inv.date ?? todayStr,
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
  }

  // Bills (skip bill_numbers that already exist)
  const billPayloadAll = [
    { vendor: v(0), number: billNo(1), status: "unpaid", date: dateStr(10), lines: [{ product: p(0), qty: 30, price: 480 }, { product: p(1), qty: 10, price: 1700 }] },
    { vendor: v(1), number: billNo(2), status: "paid", date: dateStr(25), lines: [{ product: p(2), qty: 5, price: 8800 }] },
    { vendor: v(2), number: billNo(3), status: "unpaid", date: dateStr(3), lines: [{ product: p(6), qty: 100, price: 175 }, { product: p(8), qty: 50, price: 115 }] },
    { vendor: v(3), number: billNo(4), status: "paid", date: dateStr(40), lines: [{ product: p(3), qty: 25, price: 1350 }, { product: p(5), qty: 15, price: 2050 }] },
    { vendor: v(4), number: billNo(5), status: "unpaid", date: todayStr, lines: [{ product: p(7), qty: 20, price: 440 }] },
    { vendor: v(0), number: billNo(6), status: "paid", date: dateStr(55), lines: [{ product: p(0), qty: 50, price: 475 }, { product: p(4), qty: 30, price: 780 }] },
  ];
  const { data: existingBills } = await supabase.from("bills").select("bill_number").eq("organization_id", orgId);
  const existingBillNumbers = new Set((existingBills ?? []).map((x) => x.bill_number));
  const billPayload = billPayloadAll.filter((b) => !existingBillNumbers.has(b.number));

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
        bill_date: bill.date ?? todayStr,
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

  // Stock ledger: opening balances (skip product+warehouse pairs that already have opening_balance)
  const { data: existingStock } = await supabase
    .from("stock_ledger")
    .select("product_id, warehouse_id")
    .eq("organization_id", orgId)
    .eq("reference_type", "opening_balance");
  const existingStockKey = new Set(
    (existingStock ?? []).map((s) => `${s.product_id}:${s.warehouse_id}`)
  );
  const defaultQtys = [80, 45, 25, 60, 70, 35, 120, 55, 90, 150];
  const stockEntries = [];
  for (let i = 0; i < (products ?? []).length; i++) {
    const product = products[i];
    const qty = defaultQtys[i] ?? 50;
    for (const whId of warehouseIds) {
      if (existingStockKey.has(`${product.id}:${whId}`)) continue;
      stockEntries.push({
        organization_id: orgId,
        product_id: product.id,
        warehouse_id: whId,
        qty_change: qty,
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

  console.log(
    "Seed complete. Inserted:",
    toInsert.length, "warehouses,",
    categoriesToInsert.length, "categories,",
    productsToInsert.length, "products,",
    customersToInsert.length, "customers,",
    vendorsToInsert.length, "vendors,",
    invoicePayload.length, "invoices,",
    billPayload.length, "bills,",
    stockEntries.length, "stock entries."
  );
}

seed()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

