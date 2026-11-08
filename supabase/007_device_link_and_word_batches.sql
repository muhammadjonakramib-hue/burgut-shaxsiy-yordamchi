begin;
create table if not exists public.burgut_word_batches (
 user_id uuid not null references auth.users(id) on delete cascade,date date not null,
 words text[] not null check(cardinality(words)<=5),level text not null check(level in ('B1','B2')),
 primary key(user_id,date)
);
alter table public.burgut_word_batches enable row level security;
revoke all on public.burgut_word_batches from anon,authenticated;
grant select on public.burgut_word_batches to authenticated;
drop policy if exists word_batches_read on public.burgut_word_batches;
create policy word_batches_read on public.burgut_word_batches for select to authenticated using(user_id=public.burgut_owner());
create or replace function public.burgut_word_batch(day date,keys text[],course text) returns jsonb
language plpgsql security definer set search_path='' as $batch$
declare result public.burgut_word_batches;
begin
 if auth.uid() is null or cardinality(keys)>5 or course not in ('B1','B2')
 or day<>(now() at time zone 'Asia/Tashkent')::date then raise exception 'Kunlik so‘zlar sanasi yoki ro‘yxati noto‘g‘ri'; end if;
 if exists(select 1 from unnest(keys) k where k !~ '^tr\|.{1,150}$') then raise exception 'Faqat turkcha so‘zlar'; end if;
 insert into public.burgut_word_batches values(public.burgut_owner(),day,keys,course) on conflict(user_id,date) do nothing;
 select * into result from public.burgut_word_batches where user_id=public.burgut_owner() and date=day;
 return to_jsonb(result);
end;
$batch$;
revoke all on function public.burgut_word_batch(date,text[],text) from public,anon;
grant execute on function public.burgut_word_batch(date,text[],text) to authenticated;

-- Linking a phone may move its expenses/plans, but must never merge/recompute learning history.
create or replace function public.burgut_pair_claim(pair_code uuid) returns uuid
language plpgsql security definer set search_path='' as $link$
declare target uuid; caller uuid:=auth.uid();
begin
 if caller is null then raise exception 'Authentication required'; end if;
 select owner_id into target from public.burgut_pairings where code=pair_code and expires_at>now() for update;
 if target is null or target=caller then raise exception 'Kod yaroqsiz yoki muddati tugagan'; end if;
 perform pg_advisory_xact_lock(hashtextextended(least(caller::text,target::text),19));
 perform pg_advisory_xact_lock(hashtextextended(greatest(caller::text,target::text),19));
 if exists(select 1 from public.burgut_devices where device_id=caller or owner_id=caller) then raise exception 'Bu qurilma allaqachon ulangan'; end if;
 if exists(select 1 from public.vocab_reviews where user_id=caller)
 or exists(select 1 from public.vocab_cards where user_id=caller)
 or exists(select 1 from public.budgets where user_id=caller)
 or exists(select 1 from public.burgut_records where user_id=caller and kind='vocab') then
 raise exception 'Bu qurilmada o‘quv tarixi yoki budjet bor. Tarixni saqlash uchun avtomatik birlashtirish to‘xtatildi. Asosiy hisobni bo‘sh brauzerda ulang.';
 end if;
 -- Conflict checks fail atomically; no existing row is silently overwritten.
 if exists(select 1 from public.burgut_records a join public.burgut_records b on a.kind=b.kind and a.id=b.id where a.user_id=caller and b.user_id=target)
 or exists(select 1 from public.burgut_plans a join public.burgut_plans b on a.id=b.id where a.user_id=caller and b.user_id=target)
 or exists(select 1 from public.burgut_daily_templates a join public.burgut_daily_templates b on a.id=b.id where a.user_id=caller and b.user_id=target) then
 raise exception 'Bir xil ID bilan yozuvlar bor; ma’lumotlar saqlanib qoldi. Avval zaxira oling.'; end if;
 update public.burgut_records set user_id=target where user_id=caller;
 update public.burgut_plans set user_id=target where user_id=caller;
 insert into public.burgut_daily_templates select target,id,title,start_date,until_date,start_min,end_min,category,color,note,repeat,weekdays,timezone,reminder,archived,revision,created_at from public.burgut_daily_templates where user_id=caller;
 update public.burgut_daily_occurrences set user_id=target where user_id=caller;
 delete from public.burgut_daily_templates where user_id=caller;
 insert into public.burgut_daily_preferences select target,timezone,theme from public.burgut_daily_preferences where user_id=caller on conflict(user_id) do nothing;
 delete from public.burgut_daily_preferences where user_id=caller;
 update public.burgut_daily_push set user_id=target where user_id=caller;
 -- Daily new-word batches are not review history; keep the target's current day if it exists.
 insert into public.burgut_word_batches select target,date,words,level from public.burgut_word_batches where user_id=caller on conflict(user_id,date) do nothing;
 delete from public.burgut_word_batches where user_id=caller;
 delete from public.burgut_pairings where code=pair_code;
 insert into public.burgut_devices(device_id,owner_id) values(caller,target);
 return target;
end;
$link$;
revoke all on function public.burgut_pair_claim(uuid) from public,anon;
grant execute on function public.burgut_pair_claim(uuid) to authenticated;
commit;
