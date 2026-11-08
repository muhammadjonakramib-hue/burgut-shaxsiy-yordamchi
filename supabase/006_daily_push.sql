begin;
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
commit;
