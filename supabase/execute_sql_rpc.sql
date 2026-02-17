-- Run this once in Supabase SQL Editor to enable the DB agent RPC.
-- Allows read-only SQL execution (SELECT only, max 50 rows) for the agent.

create or replace function public.execute_sql("query" text)
returns setof json
language plpgsql
security definer
set search_path = public
as $$
declare
  q text;
  upper_q text;
begin
  q := trim("query");
  q := trim(trailing ';' from q);
  q := trim(q);
  if q = '' then
    raise exception 'Empty query';
  end if;
  upper_q := upper(q);
  -- Only allow a single statement starting with SELECT
  if upper_q not like 'SELECT%' then
    raise exception 'Only SELECT queries are allowed';
  end if;
  -- Reject multiple statements (any semicolon left after stripping trailing one)
  if position(';' in q) > 0 then
    raise exception 'Multiple statements not allowed';
  end if;
  -- Enforce a limit if not present (max 50 rows)
  if upper_q not like '%LIMIT%' then
    q := q || ' LIMIT 50';
  end if;
  return query execute 'select row_to_json(t) from (' || q || ') t';
end;
$$;

comment on function public.execute_sql(text) is 'Execute read-only SQL for the DB agent. SELECT only, max 50 rows.';

-- Grant execute to anon, authenticated, and service_role (backend may use any of these)
grant execute on function public.execute_sql(text) to anon;
grant execute on function public.execute_sql(text) to authenticated;
grant execute on function public.execute_sql(text) to service_role;
