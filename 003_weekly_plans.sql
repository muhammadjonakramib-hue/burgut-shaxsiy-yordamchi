begin;
create table if not exists public.burgut_plans (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check(length(id) between 8 and 100),
  title text not null check(length(title) between 1 and 160),
  date date,
  time time,
  note text not null default '' check(length(note)<=500),
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key(user_id,id)
);
alter table public.burgut_plans enable row level security;
drop policy if exists "own plans" on public.burgut_plans;
create policy "own plans" on public.burgut_plans to authenticated
  using(user_id=public.burgut_owner()) with check(user_id=public.burgut_owner());
grant select,insert,update,delete on public.burgut_plans to authenticated;
revoke all on public.burgut_plans from anon;
create or replace function public.burgut_plan_save(item jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare owner uuid := public.burgut_owner();
begin
  if owner is null then raise exception 'Authentication required'; end if;
  insert into public.burgut_plans(user_id,id,title,date,time,note,done,done_at,created_at,updated_at,deleted)
  values(owner,item->>'id',item->>'title',nullif(item->>'date','')::date,nullif(item->>'time','')::time,
    coalesce(item->>'note',''),coalesce((item->>'done')::boolean,false),nullif(item->>'doneAt','')::timestamptz,
    (item->>'createdAt')::timestamptz,(item->>'updatedAt')::timestamptz,coalesce((item->>'deleted')::boolean,false))
  on conflict(user_id,id) do update set title=excluded.title,date=excluded.date,time=excluded.time,
    note=excluded.note,done=excluded.done,done_at=excluded.done_at,updated_at=excluded.updated_at,deleted=excluded.deleted
  where excluded.updated_at>public.burgut_plans.updated_at;
end;
$$;
revoke all on function public.burgut_plan_save(jsonb) from public,anon;
grant execute on function public.burgut_plan_save(jsonb) to authenticated;
commit;
