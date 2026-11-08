begin;
create temporary table burgut_before_guard on commit drop as select 'cards' as kind,md5(coalesce(jsonb_agg(to_jsonb(t) order by t.user_id,t.word_key)::text,'[]')) as digest from public.vocab_cards t
union all select 'reviews',md5(coalesce(jsonb_agg(to_jsonb(t) order by t.user_id,t.id)::text,'[]')) from public.vocab_reviews t
union all select 'review_function',md5(prosrc) from pg_proc where oid='public.burgut_review(text,text,text,timestamp with time zone)'::regprocedure;

create table if not exists public.burgut_daily_templates (
 user_id uuid not null references auth.users(id) on delete cascade,
 id uuid not null default gen_random_uuid(),
 title text not null check(length(trim(title)) between 1 and 160),
 start_date date not null, until_date date,
 start_min int not null check(start_min between 0 and 1439),
 end_min int not null check(end_min between 1 and 1440 and end_min>start_min),
 category text not null check(category in ('study','reading','work','sport','rest','personal','other')),
 color text not null check(color ~ '^#[0-9a-fA-F]{6}$'),
 note text not null default '' check(length(note)<=2000),
 repeat text not null check(repeat in ('once','daily','weekly')),
 weekdays int[] not null default '{}' check(weekdays <@ array[0,1,2,3,4,5,6]),
 timezone text not null default 'Asia/Tashkent',
 reminder int check(reminder between 0 and 1440),
 archived boolean not null default false,
 revision int not null default 1,
 created_at timestamptz not null default now(),
 primary key(user_id,id),check(repeat<>'weekly' or cardinality(weekdays)>0)
);
create table if not exists public.burgut_daily_occurrences (
 user_id uuid not null,template_id uuid not null,date date not null,
 status text not null default 'pending' check(status in ('pending','progress','done','skipped')),
 patch jsonb not null default '{}',cancelled boolean not null default false,
 revision int not null default 1, updated_at timestamptz not null default now(),
 primary key(user_id,template_id,date),
 foreign key(user_id,template_id) references public.burgut_daily_templates(user_id,id)
);
create table if not exists public.burgut_daily_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 timezone text not null default 'Asia/Tashkent',theme text not null default 'auto' check(theme in ('auto','light','dark'))
);
alter table public.burgut_daily_templates enable row level security;
alter table public.burgut_daily_occurrences enable row level security;
alter table public.burgut_daily_preferences enable row level security;
revoke all on public.burgut_daily_templates,public.burgut_daily_occurrences,public.burgut_daily_preferences from anon,authenticated;
grant select on public.burgut_daily_templates,public.burgut_daily_occurrences,public.burgut_daily_preferences to authenticated;
drop policy if exists daily_templates_read on public.burgut_daily_templates;
create policy daily_templates_read on public.burgut_daily_templates for select to authenticated using(user_id=public.burgut_owner());
drop policy if exists daily_occurrences_read on public.burgut_daily_occurrences;
create policy daily_occurrences_read on public.burgut_daily_occurrences for select to authenticated using(user_id=public.burgut_owner());
drop policy if exists daily_preferences_read on public.burgut_daily_preferences;
create policy daily_preferences_read on public.burgut_daily_preferences for select to authenticated using(user_id=public.burgut_owner());

create or replace function public.burgut_daily_save(item jsonb, previous_id uuid default null, effective_date date default null, expected_revision int default 0)
returns uuid language plpgsql security definer set search_path='' as $planner$
declare owner uuid:=public.burgut_owner(); old public.burgut_daily_templates; newid uuid:=(item->>'id')::uuid;
begin
 if owner is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(owner::text,19));
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=item->>'timezone') then raise exception 'Vaqt zonasi noto‘g‘ri'; end if;
 if previous_id is not null then
   select * into old from public.burgut_daily_templates where user_id=owner and id=previous_id for update;
   if not found or old.revision<>expected_revision then raise exception 'Reja boshqa qurilmada o‘zgargan. Yangilang.'; end if;
   if effective_date is null or effective_date<old.start_date or (old.until_date is not null and effective_date>old.until_date) then raise exception 'Sana noto‘g‘ri'; end if;
   update public.burgut_daily_templates set until_date=effective_date-1,revision=revision+1 where user_id=owner and id=previous_id;
 end if;
 insert into public.burgut_daily_templates(user_id,id,title,start_date,start_min,end_min,category,color,note,repeat,weekdays,timezone,reminder)
 values(owner,newid,trim(item->>'title'),(item->>'start_date')::date,(item->>'start_min')::int,(item->>'end_min')::int,item->>'category',item->>'color',coalesce(item->>'note',''),item->>'repeat',array(select jsonb_array_elements_text(item->'weekdays')::int),item->>'timezone',(item->>'reminder')::int);
 return newid;
end;
$planner$;

create or replace function public.burgut_daily_occurrence(item jsonb,expected_revision int default 0)
returns void language plpgsql security definer set search_path='' as $planner$
declare owner uuid:=public.burgut_owner(); p public.burgut_daily_templates; currentrev int; patch jsonb:=coalesce(item->'patch','{}');
begin
 if owner is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(owner::text,19));
 select * into p from public.burgut_daily_templates where user_id=owner and id=(item->>'template_id')::uuid;
 if not found then raise exception 'Reja topilmadi'; end if;
 if (item->>'date')::date<p.start_date or (p.until_date is not null and (item->>'date')::date>p.until_date)
 or (p.repeat='once' and (item->>'date')::date<>p.start_date)
 or (p.repeat='weekly' and not extract(dow from (item->>'date')::date)::int=any(p.weekdays)) then raise exception 'Bu kunda reja yo‘q'; end if;
 select revision into currentrev from public.burgut_daily_occurrences where user_id=owner and template_id=p.id and date=(item->>'date')::date;
 if coalesce(currentrev,0)<>expected_revision then raise exception 'Holat boshqa qurilmada o‘zgargan. Yangilang.'; end if;
 if jsonb_typeof(patch)<>'object' or patch - array['title','start_min','end_min','category','color','note','reminder'] <> '{}'::jsonb then raise exception 'Noto‘g‘ri maydon'; end if;
 if coalesce((patch->>'start_min')::int,p.start_min)<0 or coalesce((patch->>'end_min')::int,p.end_min)>1440 or coalesce((patch->>'start_min')::int,p.start_min)>=coalesce((patch->>'end_min')::int,p.end_min) then raise exception 'Vaqt oralig‘i noto‘g‘ri'; end if;
 if (patch ? 'title' and length(trim(patch->>'title')) not between 1 and 160)
 or (patch ? 'color' and (patch->>'color') !~ '^#[0-9a-fA-F]{6}$')
 or (patch ? 'category' and (patch->>'category') not in ('study','reading','work','sport','rest','personal','other'))
 or length(coalesce(patch->>'note',''))>2000
 or (patch ? 'reminder' and (patch->>'reminder')::int not between 0 and 1440) then raise exception 'Reja ma’lumotlari noto‘g‘ri'; end if;
 insert into public.burgut_daily_occurrences(user_id,template_id,date,status,patch,cancelled,revision)
 values(owner,p.id,(item->>'date')::date,item->>'status',patch,coalesce((item->>'cancelled')::bool,false),expected_revision+1)
 on conflict(user_id,template_id,date) do update set status=excluded.status,patch=excluded.patch,cancelled=excluded.cancelled,revision=excluded.revision,updated_at=now();
end;
$planner$;

create or replace function public.burgut_daily_stop(template_id uuid,from_date date,expected_revision int)
returns void language plpgsql security definer set search_path='' as $planner$
begin
 perform pg_advisory_xact_lock(hashtextextended(public.burgut_owner()::text,19));
 update public.burgut_daily_templates set until_date=from_date-1,revision=revision+1
 where user_id=public.burgut_owner() and id=template_id and revision=expected_revision and from_date>=start_date;
 if not found then raise exception 'Reja o‘zgargan. Yangilang.'; end if;
end;
$planner$;
create or replace function public.burgut_daily_settings(zone text,mode text) returns void
language plpgsql security definer set search_path='' as $planner$
begin
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) then raise exception 'Vaqt zonasi noto‘g‘ri'; end if;
 insert into public.burgut_daily_preferences(user_id,timezone,theme) values(public.burgut_owner(),zone,mode)
 on conflict(user_id) do update set timezone=excluded.timezone,theme=excluded.theme;
end;
$planner$;
revoke all on function public.burgut_daily_save(jsonb,uuid,date,int),public.burgut_daily_occurrence(jsonb,int),public.burgut_daily_stop(uuid,date,int),public.burgut_daily_settings(text,text) from public,anon;
grant execute on function public.burgut_daily_save(jsonb,uuid,date,int),public.burgut_daily_occurrence(jsonb,int),public.burgut_daily_stop(uuid,date,int),public.burgut_daily_settings(text,text) to authenticated;


create table if not exists public.burgut_daily_push (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 device_id uuid not null references auth.users(id) on delete cascade,endpoint text not null unique,
 subscription jsonb not null,created_at timestamptz not null default now()
);
create table if not exists public.burgut_daily_deliveries (
 subscription_id uuid not null references public.burgut_daily_push(id) on delete cascade,
 event_key text not null,leased_until timestamptz not null,sent_at timestamptz,
 primary key(subscription_id,event_key)
);
alter table public.burgut_daily_push enable row level security;
alter table public.burgut_daily_deliveries enable row level security;
revoke all on public.burgut_daily_push,public.burgut_daily_deliveries from anon,authenticated;
grant all on public.burgut_daily_push,public.burgut_daily_deliveries to service_role;
grant select on public.burgut_daily_templates,public.burgut_daily_occurrences to service_role;
create or replace function public.burgut_daily_subscribe(subscription jsonb) returns void
language plpgsql security definer set search_path='' as $push$
begin
 if auth.uid() is null or octet_length(subscription::text)>8192
 or coalesce(subscription->>'endpoint','') !~ '^https://(fcm.googleapis.com|updates.push.services.mozilla.com|web.push.apple.com|[a-zA-Z0-9-]+.notify.windows.com)/'
 or length(coalesce(subscription->'keys'->>'p256dh','')) not between 80 and 100
 or length(coalesce(subscription->'keys'->>'auth','')) not between 20 and 30 then raise exception 'Push obunasi noto‘g‘ri yoki brauzer qo‘llanmaydi'; end if;
 insert into public.burgut_daily_push(user_id,device_id,endpoint,subscription)
 values(public.burgut_owner(),auth.uid(),subscription->>'endpoint',subscription)
 on conflict(endpoint) do update set subscription=excluded.subscription,user_id=excluded.user_id
 where public.burgut_daily_push.device_id=auth.uid();
 if not found then raise exception 'Bu obuna boshqa qurilmaga tegishli'; end if;
end;
$push$;
create or replace function public.burgut_daily_unsubscribe(push_endpoint text) returns void
language sql security definer set search_path='' as $push$
 delete from public.burgut_daily_push where device_id=auth.uid() and endpoint=push_endpoint;
$push$;
create or replace function public.burgut_daily_claim_notice(sub_id uuid,event_id text) returns boolean
language plpgsql security definer set search_path='' as $push$
begin
 insert into public.burgut_daily_deliveries(subscription_id,event_key,leased_until)
 values(sub_id,event_id,now()+interval '2 minutes')
 on conflict(subscription_id,event_key) do update set leased_until=excluded.leased_until
 where public.burgut_daily_deliveries.sent_at is null and public.burgut_daily_deliveries.leased_until<now();
 return found;
end;
$push$;
revoke all on function public.burgut_daily_subscribe(jsonb),public.burgut_daily_unsubscribe(text),public.burgut_daily_claim_notice(uuid,text) from public,anon,authenticated;
grant execute on function public.burgut_daily_subscribe(jsonb),public.burgut_daily_unsubscribe(text) to authenticated;
grant execute on function public.burgut_daily_claim_notice(uuid,text) to service_role;


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

create temporary table burgut_after_guard on commit drop as select 'cards' as kind,md5(coalesce(jsonb_agg(to_jsonb(t) order by t.user_id,t.word_key)::text,'[]')) as digest from public.vocab_cards t
union all select 'reviews',md5(coalesce(jsonb_agg(to_jsonb(t) order by t.user_id,t.id)::text,'[]')) from public.vocab_reviews t
union all select 'review_function',md5(prosrc) from pg_proc where oid='public.burgut_review(text,text,text,timestamp with time zone)'::regprocedure;
do $guard$ begin
 if exists(select * from burgut_before_guard except select * from burgut_after_guard) then raise exception 'Learning history changed: repair rolled back'; end if;
end $guard$;
notify pgrst, 'reload schema';
select 'OK: oquv tarixi va algoritm saqlandi' as tekshiruv, to_regprocedure('public.burgut_daily_save(jsonb,uuid,date,integer)') as reja_funksiyasi;
commit;