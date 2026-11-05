begin;
-- Existing 001, 002 and 003 migrations must be installed first.
create table if not exists public.burgut_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('expense','vocab','todo')),
  id text not null check (length(id) between 1 and 500),
  data jsonb not null,
  updated_at timestamptz not null,
  deleted boolean not null default false,
  primary key(user_id,kind,id)
);
alter table public.burgut_records enable row level security;
revoke all on public.burgut_records from anon,authenticated;
grant select on public.burgut_records to authenticated;
drop policy if exists "records owner read" on public.burgut_records;
create policy "records owner read" on public.burgut_records for select to authenticated
  using(user_id=public.burgut_owner());
create or replace function public.burgut_record_save(item jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare owner uuid := public.burgut_owner(); stamp timestamptz := (item->>'updatedAt')::timestamptz;
begin
  if owner is null or stamp is null or stamp > now()+interval '5 minutes'
    or jsonb_typeof(item->'data') is distinct from 'object' or octet_length(item::text)>16384 then
    raise exception 'Invalid record';
  end if;
  if item->>'kind'='expense' and not coalesce((item->>'deleted')::boolean,false) then
    if coalesce((item->'data'->>'amount')::numeric,0)<=0
      or coalesce(item->'data'->>'currency','') not in ('TRY','USD','UZS')
      or coalesce(item->'data'->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Invalid expense';
    end if;
  end if;
  insert into public.burgut_records(user_id,kind,id,data,updated_at,deleted)
    values(owner,item->>'kind',item->>'id',item->'data',stamp,coalesce((item->>'deleted')::boolean,false))
  on conflict(user_id,kind,id) do update set data=excluded.data,updated_at=excluded.updated_at,deleted=excluded.deleted
    where excluded.updated_at>public.burgut_records.updated_at;
end;
$$;
revoke all on function public.burgut_record_save(jsonb) from public,anon;
grant execute on function public.burgut_record_save(jsonb) to authenticated;
create or replace function public.burgut_pair_claim(pair_code uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  -- Pair an empty new device; never silently abandon or merge existing data.
  if exists(select 1 from public.burgut_devices where device_id = auth.uid())
    or exists(select 1 from public.burgut_devices where owner_id = auth.uid())
    or exists(select 1 from public.vocab_reviews where user_id = auth.uid())
    or exists(select 1 from public.vocab_cards where user_id = auth.uid())
    or exists(select 1 from public.budgets where user_id = auth.uid())
    or exists(select 1 from public.burgut_plans where user_id = auth.uid())
    or exists(select 1 from public.burgut_records where user_id = auth.uid()) then
    raise exception 'Bu qurilmada ma’lumot bor. Bo‘sh yangi qurilmadan ulang.';
  end if;
  delete from public.burgut_pairings where code = pair_code and expires_at > now() returning owner_id into target;
  if target is null or target = auth.uid() then raise exception 'Kod yaroqsiz yoki muddati tugagan'; end if;
  insert into public.burgut_devices(device_id, owner_id) values(auth.uid(), target);
  return target;
end;
$$;

commit;
