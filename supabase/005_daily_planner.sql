begin;
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
commit;
