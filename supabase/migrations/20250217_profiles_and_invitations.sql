-- Run this in Supabase SQL editor if you already ran the main schema earlier.
-- Adds: profiles (for team listing), organization_invitations (invite flow), and policies.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  updated_at timestamptz not null default now()
);

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

create index if not exists idx_organization_invitations_org on public.organization_invitations (organization_id);
create index if not exists idx_organization_invitations_token on public.organization_invitations (token);

alter table public.profiles enable row level security;
alter table public.organization_invitations enable row level security;

create policy profiles_select on public.profiles for select
  using (exists (select 1 from public.organization_users ou1 join public.organization_users ou2 on ou1.organization_id = ou2.organization_id where ou2.user_id = auth.uid() and ou1.user_id = profiles.id));
create policy profiles_update on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_insert on public.profiles for insert
  with check (auth.uid() = id);

create policy org_invitations_select on public.organization_invitations for select
  using (public.user_in_organization(organization_id));
create policy org_invitations_select_invitee on public.organization_invitations for select
  using (trim(lower(auth.jwt() ->> 'email'::text)) = trim(lower(email)));
create policy org_invitations_insert on public.organization_invitations for insert
  with check (exists (select 1 from public.organization_users ou where ou.organization_id = organization_invitations.organization_id and ou.user_id = auth.uid() and ou.role = 'admin' and ou.status = 'active'));
create policy org_invitations_delete on public.organization_invitations for delete
  using (exists (select 1 from public.organization_users ou where ou.organization_id = organization_invitations.organization_id and ou.user_id = auth.uid() and ou.role = 'admin' and ou.status = 'active'));
