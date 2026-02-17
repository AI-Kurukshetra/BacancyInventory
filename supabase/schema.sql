-- Supabase database schema for BacancyInventory (Zoho Inventory-style SaaS)
-- Run this SQL in your Supabase project (SQL editor or migrations).

-- Extensions -----------------------------------------------------------------
create extension if not exists "pgcrypto";

-- Core tenancy tables --------------------------------------------------------

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gstin text,
  country text,
  address jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in (
    'admin',
    'sales_manager',
    'purchase_manager',
    'warehouse_staff',
    'accountant',
    'viewer'
  )),
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_organization_users_org_user
  on public.organization_users (organization_id, user_id);

-- Profiles: store email/name for team listing (synced from auth on login)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  updated_at timestamptz not null default now()
);

-- Organization invitations (invite by email + role; accept via link)
create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in (
    'admin', 'sales_manager', 'purchase_manager', 'warehouse_staff', 'accountant', 'viewer'
  )),
  token text not null unique,
  invited_by uuid references auth.users(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_organization_invitations_org
  on public.organization_invitations (organization_id);
create index if not exists idx_organization_invitations_token
  on public.organization_invitations (token);

-- Master data ----------------------------------------------------------------

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  billing_address jsonb,
  shipping_address jsonb,
  gstin text,
  pan text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_customers_org
  on public.customers (organization_id);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address jsonb,
  gstin text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_vendors_org
  on public.vendors (organization_id);

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  parent_id uuid references public.product_categories(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_categories_org
  on public.product_categories (organization_id);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  sku text,
  barcode text,
  hsn_sac text,
  tax_rate numeric(5,2),
  uom text,
  category_id uuid references public.product_categories(id) on delete set null,
  sales_price numeric(18,2),
  purchase_price numeric(18,2),
  reorder_level numeric(18,3),
  track_batch boolean not null default false,
  track_serial boolean not null default false,
  track_expiry boolean not null default false,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_products_org_sku
  on public.products (organization_id, sku)
  where sku is not null;

create index if not exists idx_products_org
  on public.products (organization_id);

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text,
  address jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_warehouses_org_code
  on public.warehouses (organization_id, code)
  where code is not null;

create index if not exists idx_warehouses_org
  on public.warehouses (organization_id);

-- Inventory & stock ledger ----------------------------------------------------

create table if not exists public.stock_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id),
  warehouse_id uuid not null references public.warehouses(id),
  batch_no text,
  serial_no text,
  expiry_date date,
  qty_change numeric(18,3) not null,
  unit_cost numeric(18,4),
  reference_type text not null, -- invoice, bill, adjustment, transfer, opening_balance, etc.
  reference_id uuid,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_ledger_org_product_warehouse
  on public.stock_ledger (organization_id, product_id, warehouse_id);

create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id),
  adjustment_type text not null check (adjustment_type in ('increase', 'decrease')),
  reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  from_warehouse_id uuid not null references public.warehouses(id),
  to_warehouse_id uuid not null references public.warehouses(id),
  status text not null default 'draft' check (status in ('draft', 'in_transit', 'completed', 'cancelled')),
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.stock_transfers(id) on delete cascade,
  product_id uuid not null references public.products(id),
  batch_no text,
  serial_no text,
  expiry_date date,
  qty numeric(18,3) not null
);

-- Sales -----------------------------------------------------------------------

create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_number text not null,
  customer_id uuid not null references public.customers(id),
  order_date date not null default current_date,
  expected_shipment_date date,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'partially_fulfilled', 'fulfilled', 'cancelled')),
  currency text default 'INR',
  subtotal numeric(18,2),
  total_tax numeric(18,2),
  total_amount numeric(18,2),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_sales_orders_org_number
  on public.sales_orders (organization_id, order_number);

create table if not exists public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  description text,
  quantity numeric(18,3) not null,
  unit_price numeric(18,2) not null,
  discount_percent numeric(5,2),
  tax_rate numeric(5,2),
  line_total numeric(18,2)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_number text not null,
  customer_id uuid not null references public.customers(id),
  sales_order_id uuid references public.sales_orders(id),
  invoice_date date not null default current_date,
  due_date date,
  status text not null default 'unpaid' check (status in ('unpaid', 'partially_paid', 'paid', 'overdue', 'void')),
  currency text default 'INR',
  subtotal numeric(18,2),
  cgst_amount numeric(18,2),
  sgst_amount numeric(18,2),
  igst_amount numeric(18,2),
  total_tax numeric(18,2),
  total_amount numeric(18,2),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_invoices_org_number
  on public.invoices (organization_id, invoice_number);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid not null references public.products(id),
  description text,
  quantity numeric(18,3) not null,
  unit_price numeric(18,2) not null,
  discount_percent numeric(5,2),
  tax_rate numeric(5,2),
  cgst_amount numeric(18,2),
  sgst_amount numeric(18,2),
  igst_amount numeric(18,2),
  line_total numeric(18,2)
);

create table if not exists public.delivery_challans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  challan_number text not null,
  customer_id uuid not null references public.customers(id),
  sales_order_id uuid references public.sales_orders(id),
  challan_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'issued', 'delivered', 'cancelled')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_delivery_challans_org_number
  on public.delivery_challans (organization_id, challan_number);

create table if not exists public.delivery_challan_items (
  id uuid primary key default gen_random_uuid(),
  delivery_challan_id uuid not null references public.delivery_challans(id) on delete cascade,
  product_id uuid not null references public.products(id),
  description text,
  quantity numeric(18,3) not null
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id),
  invoice_id uuid references public.invoices(id) on delete set null,
  amount numeric(18,2) not null,
  payment_date date not null default current_date,
  mode text,
  reference_no text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Purchases -------------------------------------------------------------------

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  po_number text not null,
  vendor_id uuid not null references public.vendors(id),
  order_date date not null default current_date,
  expected_delivery_date date,
  status text not null default 'draft' check (status in ('draft', 'sent', 'partially_received', 'closed', 'cancelled')),
  currency text default 'INR',
  subtotal numeric(18,2),
  total_tax numeric(18,2),
  total_amount numeric(18,2),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_purchase_orders_org_number
  on public.purchase_orders (organization_id, po_number);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  description text,
  quantity numeric(18,3) not null,
  unit_price numeric(18,2) not null,
  discount_percent numeric(5,2),
  tax_rate numeric(5,2),
  line_total numeric(18,2)
);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bill_number text not null,
  vendor_id uuid not null references public.vendors(id),
  purchase_order_id uuid references public.purchase_orders(id),
  bill_date date not null default current_date,
  due_date date,
  status text not null default 'unpaid' check (status in ('unpaid', 'partially_paid', 'paid', 'overdue', 'void')),
  currency text default 'INR',
  subtotal numeric(18,2),
  cgst_amount numeric(18,2),
  sgst_amount numeric(18,2),
  igst_amount numeric(18,2),
  total_tax numeric(18,2),
  total_amount numeric(18,2),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_bills_org_number
  on public.bills (organization_id, bill_number);

create table if not exists public.bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  product_id uuid not null references public.products(id),
  description text,
  quantity numeric(18,3) not null,
  unit_price numeric(18,2) not null,
  discount_percent numeric(5,2),
  tax_rate numeric(5,2),
  cgst_amount numeric(18,2),
  sgst_amount numeric(18,2),
  igst_amount numeric(18,2),
  line_total numeric(18,2)
);

create table if not exists public.vendor_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id),
  bill_id uuid references public.bills(id) on delete set null,
  amount numeric(18,2) not null,
  payment_date date not null default current_date,
  mode text,
  reference_no text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Reporting & audit -----------------------------------------------------------

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_logs_org_created_at
  on public.activity_logs (organization_id, created_at desc);

-- Row Level Security (RLS) & policies ----------------------------------------

alter table public.organizations enable row level security;
alter table public.organization_users disable row level security;
alter table public.profiles enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.customers enable row level security;
alter table public.vendors enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.warehouses enable row level security;
alter table public.stock_ledger enable row level security;
alter table public.stock_adjustments enable row level security;
alter table public.stock_transfers enable row level security;
alter table public.stock_transfer_items enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.delivery_challans enable row level security;
alter table public.delivery_challan_items enable row level security;
alter table public.payments enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.bills enable row level security;
alter table public.bill_items enable row level security;
alter table public.vendor_payments enable row level security;
alter table public.activity_logs enable row level security;

-- Helper function: check if current user belongs to organization -------------

create or replace function public.user_in_organization(org_id uuid)
returns boolean
language sql
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.organization_users ou
    where ou.organization_id = org_id
      and ou.user_id = auth.uid()
      and ou.status = 'active'
  );
$$;

-- Policies for organizations & membership ------------------------------------

create policy "Users can view their organizations"
  on public.organizations
  for select
  using (public.user_in_organization(id));

create policy "Authenticated users can create organizations"
  on public.organizations
  for insert
  with check (auth.uid() is not null);

create policy "Admins manage their organizations"
  on public.organizations
  for update
  using (
    exists (
      select 1
      from public.organization_users ou
      where ou.organization_id = organizations.id
        and ou.user_id = auth.uid()
        and ou.role = 'admin'
        and ou.status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from public.organization_users ou
      where ou.organization_id = organizations.id
        and ou.user_id = auth.uid()
        and ou.role = 'admin'
        and ou.status = 'active'
    )
  );

create policy "Admins can delete organizations"
  on public.organizations
  for delete
  using (
    exists (
      select 1
      from public.organization_users ou
      where ou.organization_id = organizations.id
        and ou.user_id = auth.uid()
        and ou.role = 'admin'
        and ou.status = 'active'
    )
  );

-- RLS and policies for organization_users are intentionally omitted to avoid
-- recursive policy issues; access is controlled via application logic while
-- RLS remains disabled on this table.

-- Generic policy template: for all tenant tables with organization_id --------

do $$
declare
  t text;
begin
  for t in
    select table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'organization_id'
      and table_name not in ('organizations', 'organization_users')
  loop
    execute format($f$
      create policy %I
      on public.%I
      for select
      using (public.user_in_organization(organization_id));
    $f$, t || '_select', t);

    execute format($f$
      create policy %I
      on public.%I
      for insert
      with check (public.user_in_organization(organization_id));
    $f$, t || '_insert', t);

    execute format($f$
      create policy %I
      on public.%I
      for update
      using (public.user_in_organization(organization_id))
      with check (public.user_in_organization(organization_id));
    $f$, t || '_update', t);

    execute format($f$
      create policy %I
      on public.%I
      for delete
      using (public.user_in_organization(organization_id));
    $f$, t || '_delete', t);
  end loop;
end;
$$;

-- Policies for child tables (no organization_id; access via parent) ----------

-- invoice_items: allow when parent invoice is in user's org
create policy invoice_items_select on public.invoice_items for select
  using (exists (select 1 from public.invoices i where i.id = invoice_items.invoice_id and public.user_in_organization(i.organization_id)));
create policy invoice_items_insert on public.invoice_items for insert
  with check (exists (select 1 from public.invoices i where i.id = invoice_items.invoice_id and public.user_in_organization(i.organization_id)));
create policy invoice_items_update on public.invoice_items for update
  using (exists (select 1 from public.invoices i where i.id = invoice_items.invoice_id and public.user_in_organization(i.organization_id)))
  with check (exists (select 1 from public.invoices i where i.id = invoice_items.invoice_id and public.user_in_organization(i.organization_id)));
create policy invoice_items_delete on public.invoice_items for delete
  using (exists (select 1 from public.invoices i where i.id = invoice_items.invoice_id and public.user_in_organization(i.organization_id)));

-- bill_items: allow when parent bill is in user's org
create policy bill_items_select on public.bill_items for select
  using (exists (select 1 from public.bills b where b.id = bill_items.bill_id and public.user_in_organization(b.organization_id)));
create policy bill_items_insert on public.bill_items for insert
  with check (exists (select 1 from public.bills b where b.id = bill_items.bill_id and public.user_in_organization(b.organization_id)));
create policy bill_items_update on public.bill_items for update
  using (exists (select 1 from public.bills b where b.id = bill_items.bill_id and public.user_in_organization(b.organization_id)))
  with check (exists (select 1 from public.bills b where b.id = bill_items.bill_id and public.user_in_organization(b.organization_id)));
create policy bill_items_delete on public.bill_items for delete
  using (exists (select 1 from public.bills b where b.id = bill_items.bill_id and public.user_in_organization(b.organization_id)));

-- Profiles: read for same-org members (team list), update own
create policy profiles_select on public.profiles for select
  using (exists (select 1 from public.organization_users ou1 join public.organization_users ou2 on ou1.organization_id = ou2.organization_id where ou2.user_id = auth.uid() and ou1.user_id = profiles.id));
create policy profiles_update on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_insert on public.profiles for insert
  with check (auth.uid() = id);

-- Invitations: org members can read; invitee can read own by email match; admins can insert/delete
create policy org_invitations_select on public.organization_invitations for select
  using (public.user_in_organization(organization_id));
create policy org_invitations_select_invitee on public.organization_invitations for select
  using (trim(lower(auth.jwt() ->> 'email'::text)) = trim(lower(email)));
create policy org_invitations_insert on public.organization_invitations for insert
  with check (exists (select 1 from public.organization_users ou where ou.organization_id = organization_invitations.organization_id and ou.user_id = auth.uid() and ou.role = 'admin' and ou.status = 'active'));
create policy org_invitations_delete on public.organization_invitations for delete
  using (exists (select 1 from public.organization_users ou where ou.organization_id = organization_invitations.organization_id and ou.user_id = auth.uid() and ou.role = 'admin' and ou.status = 'active'));

