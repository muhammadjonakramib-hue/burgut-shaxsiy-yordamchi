-- Burgut: foydalanuvchiga tegishli lug‘at takrorlash ma’lumotlari.
-- Supabase SQL Editor’da bir marta ishga tushiring.

create table if not exists public.vocab_cards (
  user_id uuid not null references auth.users(id) on delete cascade,
  word_key text not null,
  lang text not null check (lang in ('tr', 'en')),
  word text not null,
  due_at timestamptz not null,
  interval_days integer not null default 0 check (interval_days >= 0 and interval_days <= 3650),
  review_level integer not null default 0 check (review_level >= 0 and review_level <= 20),
  last_rating text check (last_rating in ('wrong', 'hard', 'correct')),
  attempts integer not null default 0 check (attempts >= 0),
  lapses integer not null default 0 check (lapses >= 0),
  last_reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, word_key)
);

create table if not exists public.vocab_reviews (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  word_key text not null,
  lang text not null check (lang in ('tr', 'en')),
  word text not null,
  rating text not null check (rating in ('wrong', 'hard', 'correct')),
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists vocab_cards_due_idx on public.vocab_cards(user_id, due_at);
create index if not exists vocab_reviews_word_idx on public.vocab_reviews(user_id, word_key, reviewed_at desc);

alter table public.vocab_cards enable row level security;
alter table public.vocab_reviews enable row level security;

drop policy if exists "vocab cards own rows" on public.vocab_cards;
create policy "vocab cards own rows" on public.vocab_cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "vocab reviews own rows" on public.vocab_reviews;
create policy "vocab reviews own rows" on public.vocab_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Xarajat budjeti ham keyin shu login bilan qurilmalarda sinxronlanadi.
create table if not exists public.budgets (
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,
  currency text not null check (currency in ('TRY', 'USD')),
  spending_limit numeric(18,2) not null default 0 check (spending_limit >= 0),
  income numeric(18,2) not null default 0 check (income >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, month, currency)
);

alter table public.budgets enable row level security;
drop policy if exists "budgets own rows" on public.budgets;
create policy "budgets own rows" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

begin;
create table if not exists public.burgut_devices (
  device_id uuid primary key references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade
);
create table if not exists public.burgut_pairings (
  code uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '10 minutes'
);
alter table public.burgut_devices enable row level security;
alter table public.burgut_pairings enable row level security;
revoke all on public.burgut_devices, public.burgut_pairings from anon, authenticated;

create or replace function public.burgut_owner() returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce((select owner_id from public.burgut_devices where device_id = auth.uid()), auth.uid());
$$;

create or replace function public.burgut_pair_create() returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.burgut_pairings where owner_id = public.burgut_owner() or expires_at < now();
  insert into public.burgut_pairings(owner_id) values (public.burgut_owner()) returning code into result;
  return result;
end;
$$;

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
    or exists(select 1 from public.budgets where user_id = auth.uid()) then
    raise exception 'Bu qurilmada ma’lumot bor. Bo‘sh yangi qurilmadan ulang.';
  end if;
  delete from public.burgut_pairings where code = pair_code and expires_at > now() returning owner_id into target;
  if target is null or target = auth.uid() then raise exception 'Kod yaroqsiz yoki muddati tugagan'; end if;
  insert into public.burgut_devices(device_id, owner_id) values(auth.uid(), target);
  return target;
end;
$$;

drop policy if exists "vocab cards own rows" on public.vocab_cards;
create policy "vocab cards own rows" on public.vocab_cards to authenticated
  using (user_id = public.burgut_owner()) with check (user_id = public.burgut_owner());
drop policy if exists "vocab reviews own rows" on public.vocab_reviews;
create policy "vocab reviews own rows" on public.vocab_reviews to authenticated
  using (user_id = public.burgut_owner()) with check (user_id = public.burgut_owner());
drop policy if exists "budgets own rows" on public.budgets;
create policy "budgets own rows" on public.budgets to authenticated
  using (user_id = public.burgut_owner()) with check (user_id = public.burgut_owner());

-- A retry keeps the original timestamp. Every card is rebuilt from its event history.
create or replace function public.burgut_review(event_id text, word_key text, rating text, reviewed_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare owner uuid := public.burgut_owner(); r record; level integer := 0;
  gaps integer[] := array[1,3,7,15,30,60,90,180,365]; gap integer := 0;
  due timestamptz; last_at timestamptz; last_rating text; attempts integer := 0; lapses integer := 0;
begin
  if owner is null or event_id is null or word_key is null or rating is null or reviewed_at is null
    or length(event_id) not between 8 and 100 or word_key !~ '^(en|tr)\|.{1,150}$'
    or rating not in ('wrong','hard','correct') or reviewed_at > now() + interval '5 minutes' then
    raise exception 'Invalid review';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(owner::text || word_key, 0));
  insert into public.vocab_reviews(id,user_id,word_key,lang,word,rating,reviewed_at)
    values(event_id,owner,word_key,split_part(word_key,'|',1),substring(word_key from 4),rating,reviewed_at)
    on conflict on constraint vocab_reviews_pkey do nothing;
  if not exists(select 1 from public.vocab_reviews v where v.user_id=owner and v.id=event_id
    and v.word_key=burgut_review.word_key and v.rating=burgut_review.rating) then
    raise exception 'Review ID conflict';
  end if;
  for r in select v.rating,v.reviewed_at from public.vocab_reviews v
    where v.user_id=owner and v.word_key=burgut_review.word_key order by v.reviewed_at,v.id loop
    level := case when r.rating='correct' then least(level+1,9) else 0 end;
    gap := case when r.rating='wrong' then 0 when r.rating='hard' then 1 else gaps[level] end;
    due := r.reviewed_at + case when r.rating='wrong' then interval '1 minute' else gap*interval '1 day' end;
    attempts := attempts+1; lapses := lapses + case when r.rating='wrong' then 1 else 0 end;
    last_at := r.reviewed_at; last_rating := r.rating;
  end loop;
  insert into public.vocab_cards(user_id,word_key,lang,word,due_at,interval_days,review_level,last_rating,attempts,lapses,last_reviewed_at)
    values(owner,word_key,split_part(word_key,'|',1),substring(word_key from 4),due,gap,level,last_rating,attempts,lapses,last_at)
    on conflict on constraint vocab_cards_pkey do update set due_at=excluded.due_at,interval_days=excluded.interval_days,
    review_level=excluded.review_level,last_rating=excluded.last_rating,attempts=excluded.attempts,
    lapses=excluded.lapses,last_reviewed_at=excluded.last_reviewed_at,updated_at=now();
end;
$$;
revoke all on function public.burgut_owner(),public.burgut_pair_create(),public.burgut_pair_claim(uuid),public.burgut_review(text,text,text,timestamptz) from public,anon;
grant execute on function public.burgut_owner(),public.burgut_pair_create(),public.burgut_pair_claim(uuid),public.burgut_review(text,text,text,timestamptz) to authenticated;
commit;

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
