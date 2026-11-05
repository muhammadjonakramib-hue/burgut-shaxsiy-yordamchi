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
