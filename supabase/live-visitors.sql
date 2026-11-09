-- Ephemeral shopping presence. No customer identity, raw query string or prices.
create table najd_private.live_visitors (
 token_hash text primary key,
 display_id uuid not null default gen_random_uuid(),
 started_at timestamptz not null default now(),
 last_seen timestamptz not null default now(),
 page_path text not null,
 cart jsonb not null default '[]'::jsonb
);
alter table najd_private.live_visitors enable row level security;
revoke all on najd_private.live_visitors from public,anon,authenticated;
create index live_visitors_last_seen on najd_private.live_visitors(last_seen);

create function najd_private.record_live_visitor(visitor_token uuid,page_path text,cart_items jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare hashed text; cleaned jsonb;
begin
 if visitor_token is null then raise exception 'Invalid visitor';end if;
 hashed:=encode(sha256(convert_to(visitor_token::text,'UTF8')),'hex');
 if exists(select 1 from public.admins where id=auth.uid()) then
  delete from najd_private.live_visitors where token_hash=hashed;return;
 end if;
 if page_path is null or length(page_path)>180 or not(page_path in ('/','/shop') or page_path ~ '^/product/[A-Za-z0-9_%.-]{1,160}$') then raise exception 'Invalid page';end if;
 if cart_items is null or jsonb_typeof(cart_items)<>'array' then raise exception 'Invalid cart';end if;
 if jsonb_array_length(cart_items)>100 or octet_length(cart_items::text)>32000 then raise exception 'Invalid cart';end if;
 -- One bounded global bucket, and at most one update per visitor every 5 seconds.
 if exists(select 1 from najd_private.live_visitors where token_hash=hashed and last_seen>now()-interval '5 seconds') then return;end if;
 perform public.consume_limit('live-visitors:global',6000,60);
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'qty',(x->>'qty')::integer,
  'color',coalesce(x->>'color',''),'size',coalesce(x->>'size','Standard')) order by n),'[]'::jsonb)
 into cleaned from jsonb_array_elements(cart_items) with ordinality a(x,n)
 join public.products p on p.id=x->>'id' and p.status='published'
 where jsonb_typeof(x)='object' and coalesce(x->>'qty','') ~ '^[1-9][0-9]{0,2}$'
 and length(coalesce(x->>'color',''))<=100 and length(coalesce(x->>'size','Standard'))<=100
 and (jsonb_array_length(coalesce(p.data->'colors','[]'))=0 and coalesce(x->>'color','')='' or p.data->'colors' ? (x->>'color'))
 and coalesce(p.data->'sizes','["Standard"]'::jsonb) ? coalesce(x->>'size','Standard');
 delete from najd_private.live_visitors where last_seen<now()-interval '10 minutes';
 insert into najd_private.live_visitors(token_hash,page_path,cart) values(hashed,page_path,cleaned)
 on conflict(token_hash) do update set page_path=excluded.page_path,cart=excluded.cart,last_seen=now()
 where live_visitors.last_seen<=now()-interval '5 seconds';
end $$;
create function public.record_live_visitor(visitor_token uuid,page_path text,cart_items jsonb)
returns void language sql security invoker set search_path='' as $$select najd_private.record_live_visitor(visitor_token,page_path,cart_items)$$;

create function najd_private.live_visitor_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.can('orders.read') then raise exception 'Forbidden' using errcode='42501';end if;
 delete from najd_private.live_visitors where last_seen<now()-interval '10 minutes';
 select jsonb_build_object('count',(select count(*) from najd_private.live_visitors where last_seen>=now()-interval '2 minutes'),
 'visitors',coalesce((select jsonb_agg(jsonb_build_object('id',display_id,'started_at',started_at,'last_seen',last_seen,'page',page_path,'cart',cart) order by last_seen desc)
 from (select * from najd_private.live_visitors where last_seen>=now()-interval '2 minutes' order by last_seen desc limit 100) v),'[]'::jsonb),
 'updated_at',now()) into result;
 return result;
end $$;
create function public.live_visitor_snapshot() returns jsonb language sql security invoker set search_path='' as $$select najd_private.live_visitor_snapshot()$$;
revoke all on function najd_private.record_live_visitor(uuid,text,jsonb),public.record_live_visitor(uuid,text,jsonb),najd_private.live_visitor_snapshot(),public.live_visitor_snapshot() from public,anon,authenticated;
grant usage on schema najd_private to anon,authenticated;
grant execute on function najd_private.record_live_visitor(uuid,text,jsonb),public.record_live_visitor(uuid,text,jsonb) to anon,authenticated;
grant execute on function najd_private.live_visitor_snapshot(),public.live_visitor_snapshot() to authenticated;
