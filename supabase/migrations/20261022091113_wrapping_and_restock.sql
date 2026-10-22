alter table public.orders add column if not exists gift_wrap boolean not null default false;
alter table public.orders add column if not exists gift_wrap_fee numeric(10,2) not null default 0 check(gift_wrap_fee>=0 and gift_wrap_fee<=1000);
CREATE OR REPLACE FUNCTION public.quote_order(customer jsonb, lines jsonb, city_index integer, coupon_code text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare settings jsonb;city jsonb;line jsonb;prod products%rowtype;cp coupons%rowtype;qty integer;sub numeric:=0;eligible numeric:=0;eligibleqty integer:=0;fee numeric:=0;discount numeric:=0;cost numeric:=0;resultitems jsonb:='[]';region_fee numeric:=0;p_cost numeric;is_wholesale boolean;wrap_fee numeric:=0;wrap_selected boolean:=false;
begin
 if lines is null or jsonb_typeof(lines)!='array' or jsonb_array_length(lines)<1 or jsonb_array_length(lines)>100 then raise exception 'Invalid cart';end if;
 select exists(select 1 from wholesale_accounts where id=auth.uid() and active) into is_wholesale;
 if is_wholesale and coupon_code!='' then raise exception 'Coupons cannot be combined with wholesale prices';end if;
 select data into settings from store_settings where id=1;
 wrap_selected:=coalesce(customer->>'gift_wrap','false')='true';
 if wrap_selected then
 if coalesce(settings->'giftWrap'->>'enabled','true')!='true' then raise exception 'Gift wrapping unavailable';end if;
 wrap_fee:=coalesce((settings->'giftWrap'->>'fee')::numeric,5);
 if wrap_fee<0 or wrap_fee>1000 or wrap_fee='NaN'::numeric then raise exception 'Invalid wrapping fee';end if;
 wrap_fee:=round(wrap_fee,2);end if;
 if city_index is null or city_index<0 or city_index>=jsonb_array_length(settings->'cities') then raise exception 'Invalid city';end if;city:=settings->'cities'->city_index;
 if city is null or city->>'enabled'='false' then raise exception 'Delivery unavailable';end if;
 if coalesce(city->>'district','') ~* 'غزة|خانيونس|خان يونس|دير البلح|رفح|gaza|khan.*yunis|deir.*balah|rafah|עזה|רפיח' or split_part(coalesce(city->>'name',''), '/', 1) ~* 'غزة|خانيونس|خان يونس|دير البلح|رفح|gaza|khan.*yunis|deir.*balah|rafah|עזה|רפיח' then raise exception 'Delivery unavailable for this governorate';end if;
 if coupon_code!='' then select * into cp from coupons c where c.code=upper(coupon_code) and active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()) and (max_uses is null or uses<max_uses) and (customer_phone is null or customer_phone=customer->>'phone');if not found then raise exception 'Coupon not valid';end if;end if;
 for line in select * from jsonb_array_elements(lines) loop
 qty:=(line->>'qty')::integer;if qty is null or qty<1 or qty>999 or (line->>'qty')::numeric!=qty then raise exception 'Invalid quantity';end if;
 select * into prod from products where id=line->>'id' and status='published';if not found then raise exception 'Product unavailable';end if;
 if coalesce(settings->'categoryMeta'->(prod.data->>'category')->>'hidden','false')='true' or exists(select 1 from jsonb_array_elements(coalesce(settings->'categories','[]')) c where c->>0=prod.data->>'category' and coalesce(settings->'categoryMeta'->(c->>4)->>'hidden','false')='true') then raise exception 'Product unavailable';end if;
 if is_wholesale then select coalesce((select w.price from wholesale_prices w where w.id=prod.id),prod.price) into prod.price;end if;
 if (select sum((x->>'qty')::integer) from jsonb_array_elements(lines) x where x->>'id'=prod.id)>prod.stock then raise exception 'Insufficient stock';end if;
 if jsonb_array_length(coalesce(prod.data->'colors','[]'))>0 and not(prod.data->'colors' ? coalesce(line->>'color','')) then raise exception 'Invalid color';end if;
 if not(coalesce(prod.data->'sizes','["Standard"]') ? coalesce(line->>'size','Standard')) then raise exception 'Invalid size';end if;
 if prod.data->'variants' is not null and prod.data->'variants'<>'null'::jsonb and coalesce((select (v->>'stock')::integer from jsonb_array_elements(prod.data->'variants') v where v->>'color'=coalesce(line->>'color','') and v->>'size'=coalesce(line->>'size','Standard')),0)<(select sum((x->>'qty')::integer) from jsonb_array_elements(lines) x where x->>'id'=prod.id and coalesce(x->>'color','')=coalesce(line->>'color','') and coalesce(x->>'size','Standard')=coalesce(line->>'size','Standard')) then raise exception 'Insufficient variant stock';end if;
 sub:=sub+prod.price*qty;select coalesce(c.cost,0) into p_cost from product_costs c where c.id=prod.id;cost:=cost+coalesce(p_cost,0)*qty;
 if cp.id is not null and (cardinality(cp.product_ids)=0 or prod.id=any(cp.product_ids)) and (cardinality(cp.category_ids)=0 or prod.data->>'category'=any(cp.category_ids)) then eligible:=eligible+prod.price*qty;eligibleqty:=eligibleqty+qty;end if;
 resultitems:=resultitems||jsonb_build_array(jsonb_build_object('id',prod.id,'qty',qty,'price',prod.price,'unit_cost',coalesce(p_cost,0),'color',coalesce(line->>'color',''),'size',coalesce(line->>'size','Standard'),'product',jsonb_build_object('id',prod.id,'name',prod.data->'name','images',prod.data->'images','price',prod.price)));
 end loop;
 if sub<coalesce((city->>'minimum')::numeric,0) then raise exception 'Minimum order not met';end if;
 if coalesce(customer->>'region','')!='' then select coalesce((r->>'fee')::numeric,0) into region_fee from jsonb_array_elements(coalesce(city->'regions','[]')) r where r->>'name'=customer->>'region';if not found then raise exception 'Invalid region';end if;end if;
 fee:=coalesce((city->>'fee')::numeric,0)+coalesce((city->>'remoteFee')::numeric,0)+coalesce(region_fee,0);
 if coalesce((city->>'freeAbove')::numeric,0)>0 and sub>=(city->>'freeAbove')::numeric then fee:=0;end if;
 if cp.id is not null then
 if sub<cp.min_total or eligibleqty<cp.min_quantity then raise exception 'Coupon conditions not met';end if;
 if cp.kind='percent' then discount:=round(eligible*cp.value/100,2);elsif cp.kind='fixed' then discount:=least(eligible,cp.value);elsif cp.kind='shipping' then fee:=0;end if;
 end if;
 return jsonb_build_object('subtotal',sub,'discount',discount,'delivery',fee,'gift_wrap',wrap_selected,'gift_wrap_fee',wrap_fee,'total',sub-discount+fee+wrap_fee,'items',resultitems,'cost_total',cost,'city',city->>'name');
end $function$
;
CREATE OR REPLACE FUNCTION public.place_order(customer jsonb, lines jsonb, city_index integer, coupon_code text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare q jsonb;p products%rowtype;item jsonb;o orders%rowtype;v_phone text;
begin
 v_phone:=btrim(customer->>'phone');if length(coalesce(customer->>'name','')) not between 2 and 100 or v_phone is null or v_phone !~ '^\+?[0-9]{8,15}$' or length(coalesce(customer->>'address','')) not between 5 and 500 then raise exception 'Invalid customer';end if;
 perform consume_limit('order:'||v_phone,5,3600);
 -- Serialize product reservations in a stable order, then quote against locked current rows.
 for p in select * from products where id in(select x->>'id' from jsonb_array_elements(lines) x) order by id for update loop null;end loop;
 if coupon_code!='' then perform 1 from coupons where code=upper(coupon_code) for update;end if;
 q:=quote_order(customer,lines,city_index,coupon_code);
 for item in select * from jsonb_array_elements(q->'items') loop update products set stock=stock-(item->>'qty')::integer where id=item->>'id';end loop;
 if coupon_code!='' then update coupons set uses=uses+1 where code=upper(coupon_code);end if;
 insert into orders(name,phone,city,address,items,subtotal,delivery,discount,total,region,notes,cost_total,coupon_code,marketing_consent,gift_wrap,gift_wrap_fee) values(left(customer->>'name',100),v_phone,q->>'city',customer->>'address',q->'items',(q->>'subtotal')::numeric,(q->>'delivery')::numeric,(q->>'discount')::numeric,(q->>'total')::numeric,left(coalesce(customer->>'region',''),100),left(coalesce(customer->>'notes',''),1000),(q->>'cost_total')::numeric,upper(coupon_code),coalesce((customer->>'marketing_consent')::boolean,false),(q->>'gift_wrap')::boolean,(q->>'gift_wrap_fee')::numeric) returning * into o;
 insert into customers(phone,name,marketing_consent) values(v_phone,o.name,o.marketing_consent) on conflict(phone) do update set name=excluded.name,marketing_consent=excluded.marketing_consent,updated_at=now();
 return to_jsonb(o)-'cost_total'-'internal_notes'-'items'||jsonb_build_object('items',(select jsonb_agg(x-'unit_cost') from jsonb_array_elements(o.items) x));
end$function$
;
CREATE OR REPLACE FUNCTION public.edit_order(order_id text, expected_version integer, changes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o orders%rowtype;item jsonb;p products%rowtype;newlines jsonb;clean jsonb:='[]';newstatus text;old_reserved boolean;new_reserved boolean;qty integer;oldqty integer;newqty integer;price numeric;unitcost numeric;sub numeric:=0;cost numeric:=0;disc numeric;fee numeric;extra numeric;v_paid numeric;
begin
 if not public.can('orders.write') then raise exception 'Forbidden';end if;
 select * into o from orders where id=order_id for update;if not found then raise exception 'Order not found';end if;if o.version!=expected_version then raise exception 'Order changed; refresh before saving';end if;
 newstatus:=coalesce(changes->>'status',o.status);if newstatus not in ('new','pending','confirmed','preparing','ready','shipped','in_transit','delivered','completed','cancelled','returned') then raise exception 'Invalid status';end if;
 old_reserved:=o.status not in ('cancelled','returned');new_reserved:=newstatus not in ('cancelled','returned');
 newlines:=coalesce(changes->'items',o.items);if jsonb_array_length(newlines)<1 or jsonb_array_length(newlines)>100 then raise exception 'Invalid items';end if;
 for p in select * from products where id in(select x->>'id' from jsonb_array_elements(o.items||newlines) x) order by id for update loop
 select coalesce(sum((x->>'qty')::integer),0) into oldqty from jsonb_array_elements(o.items) x where x->>'id'=p.id;
 select coalesce(sum((x->>'qty')::integer),0) into newqty from jsonb_array_elements(newlines) x where x->>'id'=p.id;
 oldqty:=case when old_reserved then oldqty else 0 end;newqty:=case when new_reserved then newqty else 0 end;
 if p.stock+oldqty<newqty then raise exception 'Insufficient stock';end if;
 update products set stock=stock+oldqty-newqty where id=p.id;
 end loop;
 for item in select * from jsonb_array_elements(newlines) loop
 qty:=(item->>'qty')::integer;if qty is null or qty<1 or qty>999 or qty!=(item->>'qty')::numeric then raise exception 'Invalid quantity';end if;
 select * into p from products where id=item->>'id';if not found then raise exception 'Product unavailable';end if;
 select (x->>'price')::numeric,(x->>'unit_cost')::numeric into price,unitcost from jsonb_array_elements(o.items) x where x->>'id'=p.id limit 1;
 price:=coalesce(price,p.price);if unitcost is null then select c.cost into unitcost from product_costs c where c.id=p.id;end if;unitcost:=coalesce(unitcost,0);
 if jsonb_array_length(coalesce(p.data->'colors','[]'))>0 and not(p.data->'colors' ? coalesce(item->>'color','')) then raise exception 'Invalid color';end if;
 if not(coalesce(p.data->'sizes','["Standard"]') ? coalesce(item->>'size','Standard')) then raise exception 'Invalid size';end if;
 sub:=sub+qty*price;cost:=cost+qty*unitcost;clean:=clean||jsonb_build_array(jsonb_build_object('id',p.id,'qty',qty,'price',price,'unit_cost',unitcost,'color',item->>'color','size',item->>'size','product',jsonb_build_object('name',p.data->'name','images',p.data->'images','price',price)));
 end loop;
 disc:=coalesce((changes->>'discount')::numeric,o.discount);fee:=coalesce((changes->>'delivery')::numeric,o.delivery);extra:=coalesce((changes->>'extra_fees')::numeric,o.extra_fees);v_paid:=coalesce((changes->>'paid')::numeric,o.paid);
 if disc<0 or disc>sub or fee<0 or extra<0 or v_paid<0 or v_paid>sub-disc+fee+extra+coalesce(o.gift_wrap_fee,0) then raise exception 'Invalid totals';end if;
 update orders set name=left(coalesce(changes->>'name',o.name),100),phone=left(coalesce(changes->>'phone',o.phone),20),address=left(coalesce(changes->>'address',o.address),500),region=left(coalesce(changes->>'region',o.region),100),notes=left(coalesce(changes->>'notes',o.notes),1000),internal_notes=left(coalesce(changes->>'internal_notes',o.internal_notes),1000),courier_id=case when changes ? 'courier_id' then nullif(changes->>'courier_id','')::uuid else o.courier_id end,tracking_number=left(coalesce(changes->>'tracking_number',o.tracking_number),200),status=newstatus,items=clean,subtotal=sub,discount=disc,delivery=fee,extra_fees=extra,total=sub-disc+fee+extra+coalesce(o.gift_wrap_fee,0),paid=v_paid,cost_total=cost,expenses=coalesce((changes->>'expenses')::numeric,o.expenses),version=version+1,updated_at=now() where id=o.id returning * into o;
 return to_jsonb(o);
end$function$
;
create table public.restock_requests(
id uuid primary key default gen_random_uuid(),
product_id text not null references public.products(id) on delete cascade,
phone text not null check(phone ~ '^\+[1-9][0-9]{7,14}$'),
created_at timestamptz not null default now(),
contacted boolean not null default false,
unique(product_id,phone));
alter table public.restock_requests enable row level security;
revoke all on public.restock_requests from public,anon,authenticated;
grant select on public.restock_requests to authenticated;
grant update(contacted) on public.restock_requests to authenticated;
create policy restock_staff_read on public.restock_requests for select to authenticated using(public.can('orders.read'));
create policy restock_staff_update on public.restock_requests for update to authenticated using(public.can('orders.write')) with check(public.can('orders.write'));
create index restock_created on public.restock_requests(created_at desc);
-- Intentional public guest submission endpoint. It never returns contacts or row IDs.
-- Writes are bounded, product visibility is checked, and staff-only reads use RLS.
create or replace function public.request_restock(product_id text,phone_number text)
returns void language plpgsql security definer set search_path='' as $body$
declare p public.products%rowtype;s jsonb;
begin
 if phone_number is null or phone_number !~ '^\+[1-9][0-9]{7,14}$' or length(product_id)>100 then raise exception 'Invalid request';end if;
 select * into p from public.products where id=product_id and status='published' and stock<=0;
 if not found or coalesce(p.data->>'isSample','false')='true' or p.id like 'demo-%' then raise exception 'Product unavailable';end if;
 select data into s from public.store_settings where id=1;
 if coalesce(s->'categoryMeta'->(p.data->>'category')->>'hidden','false')='true' or exists(select 1 from jsonb_array_elements(coalesce(s->'categories','[]')) c where c->>0=p.data->>'category' and coalesce(s->'categoryMeta'->(c->>4)->>'hidden','false')='true') then raise exception 'Product unavailable';end if;
 perform public.consume_limit('restock:global',100,60);
 perform public.consume_limit('restock:'||md5(phone_number),5,3600);
 insert into public.restock_requests(product_id,phone) values(p.id,phone_number) on conflict on constraint restock_requests_product_id_phone_key do update set contacted=false,created_at=now();
end $body$;
revoke all on function public.request_restock(text,text) from public,anon,authenticated;
grant execute on function public.request_restock(text,text) to anon,authenticated;
update public.store_settings set data=jsonb_set(data,'{giftWrap}','{"enabled":true,"fee":5}'::jsonb) where id=1 and not(data ? 'giftWrap');

-- Seed missing bag subcategories without replacing existing names, photos or product assignments.
do $seed$
declare s jsonb;c jsonb;
begin
 select data into s from public.store_settings where id=1 for update;
 if s is null then return;end if;
 for c in select value from jsonb_array_elements('[["bags-shoulder","شنط الكتف","Shoulder bags","תיקי כתף","bags"],["bags-hand","شنط اليد","Handbags","תיקי יד","bags"]]'::jsonb) loop
 if not exists(select 1 from jsonb_array_elements(s->'categories') x where x->>0=c->>0 or (x->>4='bags' and x->>1=c->>1)) then
 s:=jsonb_set(s,'{categories}',(s->'categories')||jsonb_build_array(c));
 s:=jsonb_set(s,'{categoryMeta}',coalesce(s->'categoryMeta','{}')||jsonb_build_object(c->>0,jsonb_build_object('home',false,'hidden',false,'image',case when c->>0='bags-hand' then '/images/demo-burgundy-tophandle.webp' else '/images/demo-ivory-shoulder.webp' end)));
 end if;end loop;
 update public.store_settings set data=s where id=1;
end $seed$;
