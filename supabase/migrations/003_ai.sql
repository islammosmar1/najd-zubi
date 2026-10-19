create table ai_config(id integer primary key check(id=1),enabled boolean not null default false,instructions text not null default 'You are a warm, concise beauty shopping advisor. Use only verified store product information.',daily_calls integer not null default 100 check(daily_calls between 1 and 100000),daily_tokens integer not null default 200000 check(daily_tokens>=0),retention_days integer not null default 0 check(retention_days between 0 and 365));
insert into ai_config(id) values(1);
alter table ai_config enable row level security;create policy "AI settings" on ai_config for all to authenticated using(public.can('ai.manage')) with check(public.can('ai.manage'));
create table ai_usage(day date primary key default current_date,calls integer not null default 0,tokens bigint not null default 0);
alter table ai_usage enable row level security;create policy "AI usage readers" on ai_usage for select to authenticated using(public.can('ai.manage'));
create table ai_logs(id uuid primary key default gen_random_uuid(),created_at timestamptz not null default now(),question text,reply text,recommended_ids text[] not null default '{}',tokens integer not null default 0,expires_at timestamptz not null);
alter table ai_logs enable row level security;create policy "AI logs readers" on ai_logs for select to authenticated using(public.can('ai.manage'));create policy "AI logs deletion" on ai_logs for delete to authenticated using(public.can('ai.manage'));
create function public.reserve_ai_usage(reservation integer,request_bucket text) returns jsonb language plpgsql security definer set search_path=public as $$declare cfg ai_config%rowtype;u ai_usage%rowtype;begin
 select * into cfg from ai_config where id=1 for update;if not cfg.enabled then raise exception 'AI is disabled';end if;
 perform consume_limit('ai:'||request_bucket,10,60);
 insert into ai_usage(day) values(current_date) on conflict do nothing;
 select * into u from ai_usage where day=current_date for update;
 if u.calls>=cfg.daily_calls or u.tokens+reservation>cfg.daily_tokens then raise exception 'AI daily limit reached';end if;
 update ai_usage set calls=calls+1,tokens=tokens+reservation where day=current_date;
 delete from ai_logs where expires_at<=now();
 return to_jsonb(cfg);
end$$;
create function public.finish_ai_usage(reservation integer,actual_tokens integer,user_question text,assistant_reply text,ids text[]) returns void language plpgsql security definer set search_path=public as $$declare keepdays integer;begin
 update ai_usage set tokens=greatest(0,tokens-reservation+greatest(actual_tokens,0)) where day=current_date;
 select retention_days into keepdays from ai_config where id=1;
 insert into ai_logs(question,reply,recommended_ids,tokens,expires_at) values(case when keepdays>0 then left(user_question,2000) else null end,case when keepdays>0 then left(assistant_reply,8000) else null end,ids,actual_tokens,now()+make_interval(days=>greatest(keepdays,1)));
end$$;
revoke all on function public.reserve_ai_usage(integer,text) from public;
revoke all on function public.finish_ai_usage(integer,integer,text,text,text[]) from public;
grant execute on function public.reserve_ai_usage(integer,text) to service_role;
grant execute on function public.finish_ai_usage(integer,integer,text,text,text[]) to service_role;
-- A service-authenticated Edge Function enforces IP limits and optional CAPTCHA before placing an order.
revoke execute on function public.place_order(jsonb,jsonb,integer,text) from anon,authenticated;
grant execute on function public.place_order(jsonb,jsonb,integer,text) to service_role;
grant execute on function public.consume_limit(text,integer,integer) to service_role;

-- Explicit least-privilege grants for projects with automatic exposure disabled.
revoke all on all tables in schema public from anon,authenticated;
grant usage on schema public to anon,authenticated,service_role;
grant select on products,store_settings,reviews to anon,authenticated;
grant select,insert,update,delete on admins,products,product_costs,store_settings,couriers,coupons,product_drafts to authenticated;
grant select on orders,audit_log,ai_usage to authenticated;
grant select,update on customers,return_requests to authenticated;
grant delete on reviews,ai_logs to authenticated;
grant select on ai_logs to authenticated;
grant select,insert,update,delete on ai_config to authenticated;
grant all on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;
revoke execute on function public.checkout_quote(jsonb,jsonb,integer,text) from public;
grant execute on function public.checkout_quote(jsonb,jsonb,integer,text) to anon,authenticated;
revoke execute on function public.audit_change() from public,anon,authenticated;
revoke execute on function public.staff_guard() from public,anon,authenticated;
revoke execute on function public.quote_order(jsonb,jsonb,integer,text) from anon,authenticated;
alter function public.staff_guard() set search_path=public;

-- Initial owner is claimed only by a verified account matching the privately configured owner email.
create schema if not exists najd_private;
revoke all on schema najd_private from public,anon,authenticated;
create table najd_private.owner_bootstrap(id integer primary key check(id=1),email text not null);
alter table najd_private.owner_bootstrap enable row level security;
create function public.claim_store_owner() returns boolean language plpgsql security definer set search_path='' as $$
declare intended text; current_email text; confirmed timestamptz;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if exists(select 1 from public.admins where id=auth.uid()) then return true;end if;
 select email into intended from najd_private.owner_bootstrap where id=1 for update;
 if intended is null or exists(select 1 from public.admins) then return false;end if;
 select email,email_confirmed_at into current_email,confirmed from auth.users where id=auth.uid();
 if confirmed is null or lower(current_email)<>lower(intended) then return false;end if;
 insert into public.admins(id,role,permissions,display_name) values(auth.uid(),'owner',array['*'],'Store owner');
 delete from najd_private.owner_bootstrap where id=1;
 return true;
end$$;
revoke all on function public.claim_store_owner() from public,anon;
grant execute on function public.claim_store_owner() to authenticated;
create index orders_created_at_idx on orders(created_at desc);
create index orders_phone_idx on orders(phone);
create index orders_status_idx on orders(status,created_at desc);
create index orders_courier_idx on orders(courier_id);
create index products_published_idx on products(status,updated_at desc);
create index reviews_product_idx on reviews(product_id);
create index return_requests_order_idx on return_requests(order_id);
create index audit_log_created_idx on audit_log(created_at desc);
create index product_drafts_owner_idx on product_drafts(owner_id,updated_at desc);
