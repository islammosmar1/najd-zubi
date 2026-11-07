create table najd_private.site_visits(session_id uuid primary key,visitor_id uuid not null,started_at timestamptz not null default now());
alter table najd_private.site_visits enable row level security;
revoke all on najd_private.site_visits from public,anon,authenticated;
create index site_visits_started_at on najd_private.site_visits(started_at);
create index site_visits_visitor on najd_private.site_visits(visitor_id);
create function najd_private.record_site_visit(visitor uuid,session uuid) returns void language plpgsql security definer set search_path=public,najd_private as $$
begin
 if visitor is null or session is null then raise exception 'Invalid visit';end if;
 if exists(select 1 from public.admins where id=auth.uid()) then return;end if;
 insert into najd_private.site_visits(session_id,visitor_id) values(session,visitor) on conflict(session_id) do nothing;
end $$;
create function public.record_site_visit(visitor uuid,session uuid) returns void language sql security invoker set search_path=public as $$select najd_private.record_site_visit(visitor,session)$$;
create function najd_private.site_visit_stats() returns jsonb language plpgsql security definer set search_path=public,najd_private as $$
declare today timestamptz:=date_trunc('day',now() at time zone 'Asia/Hebron') at time zone 'Asia/Hebron';
begin
 if not public.can('orders.read') and not public.can('settings.write') then raise exception 'Forbidden';end if;
 return (select jsonb_build_object('visitors_today',count(distinct visitor_id) filter(where started_at>=today),'visitors_total',count(distinct visitor_id),'visits_today',count(*) filter(where started_at>=today),'visits_total',count(*),'started_at',min(started_at)) from najd_private.site_visits);
end $$;
create function public.site_visit_stats() returns jsonb language sql security invoker set search_path=public as $$select najd_private.site_visit_stats()$$;
revoke all on function najd_private.record_site_visit(uuid,uuid),public.record_site_visit(uuid,uuid),najd_private.site_visit_stats(),public.site_visit_stats() from public,anon,authenticated;
grant usage on schema najd_private to anon,authenticated;
grant execute on function najd_private.record_site_visit(uuid,uuid),public.record_site_visit(uuid,uuid) to anon,authenticated;
grant execute on function najd_private.site_visit_stats(),public.site_visit_stats() to authenticated;
