-- Apply after 001_store.sql. Forward-only migration; back up existing production data first.
alter table admins add column role text not null default 'owner',add column permissions text[] not null default array['*'],add column display_name text not null default '',add column require_mfa boolean not null default false;
create function public.can(action text) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from admins a where a.id=auth.uid() and ('*'=any(a.permissions) or action=any(a.permissions)) and (not a.require_mfa or auth.jwt()->>'aal'='aal2'))$$;
revoke all on function public.can(text) from public;grant execute on function public.can(text) to anon,authenticated;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$select public.can('*')$$;
create policy "Owners manage staff" on admins for all to authenticated using(public.can('staff.manage')) with check(public.can('staff.manage'));
create function public.staff_guard() returns trigger language plpgsql as $$begin
 if TG_OP='DELETE' and OLD.id=auth.uid() then raise exception 'Cannot delete own membership';end if;
 if TG_OP='UPDATE' and OLD.id=auth.uid() and (NEW.permissions!=OLD.permissions or NEW.role!=OLD.role) then raise exception 'Cannot change own role';end if;
 return coalesce(NEW,OLD);end$$;
create trigger staff_guard before update or delete on admins for each row execute function public.staff_guard();
alter table products add column status text not null default 'published' check(status in ('draft','published','hidden','archived')),add column sku text,add column barcode text,add column updated_at timestamptz not null default now();
create unique index products_unique_sku on products(lower(sku)) where sku is not null and sku!='';
create unique index products_unique_barcode on products(barcode) where barcode is not null and barcode!='';
drop policy "Public catalog" on products;drop policy "Admin catalog" on products;
create policy "Published catalog" on products for select using(status='published' or public.can('products.read'));
create policy "Product writes" on products for all to authenticated using(public.can('products.write')) with check(public.can('products.write'));
drop policy "Admin costs" on product_costs;
create policy "Cost reads" on product_costs for select to authenticated using(public.can('reports.read'));
create policy "Cost writes" on product_costs for all to authenticated using(public.can('products.write')) with check(public.can('products.write'));
drop policy "Admin settings" on store_settings;create policy "Settings writes" on store_settings for all to authenticated using(public.can('settings.write')) with check(public.can('settings.write'));
drop policy "Admin orders read" on orders;create policy "Orders read" on orders for select to authenticated using(public.can('orders.read'));
drop policy "Admin image uploads" on storage.objects;drop policy "Admin image updates" on storage.objects;drop policy "Admin image delete" on storage.objects;
create policy "Product images insert" on storage.objects for insert to authenticated with check(bucket_id='products' and public.can('products.write'));
create policy "Product images update" on storage.objects for update to authenticated using(bucket_id='products' and public.can('products.write')) with check(bucket_id='products' and public.can('products.write'));
create policy "Product images delete" on storage.objects for delete to authenticated using(bucket_id='products' and public.can('products.write'));
create table audit_log(id bigint generated always as identity primary key,created_at timestamptz not null default now(),actor uuid,table_name text not null,record_id text,action text not null,before_data jsonb,after_data jsonb);
alter table audit_log enable row level security;create policy "Audit readers" on audit_log for select to authenticated using(public.can('audit.read'));
create function public.audit_change() returns trigger language plpgsql security definer set search_path=public as $$begin insert into audit_log(actor,table_name,record_id,action,before_data,after_data) values(auth.uid(),TG_TABLE_NAME,coalesce(to_jsonb(NEW)->>'id',to_jsonb(OLD)->>'id'),TG_OP,to_jsonb(OLD),to_jsonb(NEW));return coalesce(NEW,OLD);end$$;
create trigger products_audit after insert or update or delete on products for each row execute function public.audit_change();
create trigger orders_audit after insert or update or delete on orders for each row execute function public.audit_change();
create trigger staff_audit after insert or update or delete on admins for each row execute function public.audit_change();
create trigger settings_audit after update on store_settings for each row execute function public.audit_change();
alter table orders drop constraint orders_status_check;
alter table orders add constraint orders_status_check check(status in ('new','pending','confirmed','preparing','ready','shipped','in_transit','delivered','completed','cancelled','returned'));
alter table orders add column region text not null default '',add column notes text not null default '',add column internal_notes text not null default '',add column courier_id uuid,add column tracking_number text not null default '',add column paid numeric(12,2) not null default 0 check(paid>=0),add column extra_fees numeric(12,2) not null default 0 check(extra_fees>=0),add column expenses numeric(12,2) not null default 0 check(expenses>=0),add column cost_total numeric(12,2) not null default 0,add column version integer not null default 1,add column updated_at timestamptz not null default now(),add column coupon_code text not null default '',add column marketing_consent boolean not null default false;
create table couriers(id uuid primary key default gen_random_uuid(),name text not null,phone text not null default '',tracking_url text not null default '',expected_days integer not null default 3 check(expected_days>=0),active boolean not null default true);
alter table couriers enable row level security;
create policy "Courier reads" on couriers for select to authenticated using(public.can('orders.read'));
create policy "Courier writes" on couriers for all to authenticated using(public.can('delivery.write')) with check(public.can('delivery.write'));
alter table orders add foreign key(courier_id) references couriers(id);
create table customers(id uuid primary key default gen_random_uuid(),phone text unique not null,name text not null,notes text not null default '',points integer not null default 0 check(points>=0),marketing_consent boolean not null default false,updated_at timestamptz not null default now());
alter table customers enable row level security;
create policy "CRM reads" on customers for select to authenticated using(public.can('customers.read'));
create policy "CRM writes" on customers for update to authenticated using(public.can('customers.write')) with check(public.can('customers.write'));
create table coupons(id uuid primary key default gen_random_uuid(),code text unique not null check(code=upper(code)),kind text not null check(kind in ('percent','fixed','shipping')),value numeric(12,2) not null default 0 check(value>=0),starts_at timestamptz,ends_at timestamptz,min_total numeric(12,2) not null default 0,max_uses integer,uses integer not null default 0,customer_phone text,product_ids text[] not null default '{}',category_ids text[] not null default '{}',min_quantity integer not null default 1,active boolean not null default true,check(kind!='percent' or value<=100),check(max_uses is null or max_uses>=0));
alter table coupons enable row level security;
create policy "Coupon admins" on coupons for all to authenticated using(public.can('promotions.write')) with check(public.can('promotions.write'));
create table product_drafts(id text primary key,owner_id uuid not null default auth.uid(),data jsonb not null,updated_at timestamptz not null default now());alter table product_drafts enable row level security;
create policy "Own drafts" on product_drafts for all to authenticated using(owner_id=auth.uid() and public.can('products.write')) with check(owner_id=auth.uid() and public.can('products.write'));
create table return_requests(id uuid primary key default gen_random_uuid(),order_id text not null references orders(id),kind text not null check(kind in ('return','exchange')),reason text not null,status text not null default 'requested' check(status in ('requested','approved','rejected','received')),created_at timestamptz not null default now());
alter table return_requests enable row level security;create policy "Returns read" on return_requests for select to authenticated using(public.can('orders.read'));create policy "Returns update" on return_requests for update to authenticated using(public.can('orders.write')) with check(public.can('orders.write'));
create table rate_limits(key text primary key,window_start timestamptz not null,count integer not null);
alter table rate_limits enable row level security;
create function public.consume_limit(bucket text,limit_count integer,seconds integer) returns void language plpgsql security definer set search_path=public as $$declare n integer;begin insert into rate_limits(key,window_start,count) values(bucket,now(),1) on conflict(key) do update set count=case when rate_limits.window_start<now()-make_interval(secs=>seconds) then 1 else rate_limits.count+1 end,window_start=case when rate_limits.window_start<now()-make_interval(secs=>seconds) then now() else rate_limits.window_start end returning count into n;if n>limit_count then raise exception 'Rate limit reached';end if;end$$;
revoke all on function public.consume_limit(text,integer,integer) from public;
-- Quote only uses server catalog prices. IDs and variant selections are untrusted.
create function public.quote_order(customer jsonb,lines jsonb,city_index integer,coupon_code text default '') returns jsonb language plpgsql security definer set search_path=public as $$
declare settings jsonb;city jsonb;line jsonb;prod products%rowtype;cp coupons%rowtype;qty integer;sub numeric:=0;eligible numeric:=0;eligibleqty integer:=0;fee numeric:=0;discount numeric:=0;cost numeric:=0;resultitems jsonb:='[]';region_fee numeric:=0;p_cost numeric;
begin
 if lines is null or jsonb_typeof(lines)!='array' or jsonb_array_length(lines)<1 or jsonb_array_length(lines)>100 then raise exception 'Invalid cart';end if;
 select data into settings from store_settings where id=1;
 if city_index is null or city_index<0 or city_index>=jsonb_array_length(settings->'cities') then raise exception 'Invalid city';end if;city:=settings->'cities'->city_index;
 if city is null then raise exception 'Delivery unavailable';end if;
 if coupon_code!='' then select * into cp from coupons c where c.code=upper(coupon_code) and active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()) and (max_uses is null or uses<max_uses) and (customer_phone is null or customer_phone=customer->>'phone');if not found then raise exception 'Coupon not valid';end if;end if;
 for line in select * from jsonb_array_elements(lines) loop
 qty:=(line->>'qty')::integer;if qty is null or qty<1 or qty>999 or (line->>'qty')::numeric!=qty then raise exception 'Invalid quantity';end if;
 select * into prod from products where id=line->>'id' and status='published';if not found then raise exception 'Product unavailable';end if;
 if (select sum((x->>'qty')::integer) from jsonb_array_elements(lines) x where x->>'id'=prod.id)>prod.stock then raise exception 'Insufficient stock';end if;
 if jsonb_array_length(coalesce(prod.data->'colors','[]'))>0 and not(prod.data->'colors' ? coalesce(line->>'color','')) then raise exception 'Invalid color';end if;
 if not(coalesce(prod.data->'sizes','["Standard"]') ? coalesce(line->>'size','Standard')) then raise exception 'Invalid size';end if;
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
 return jsonb_build_object('subtotal',sub,'discount',discount,'delivery',fee,'total',sub-discount+fee,'items',resultitems,'cost_total',cost,'city',city->>'name');
end $$;
revoke all on function public.quote_order(jsonb,jsonb,integer,text) from public;
-- Public quote wrapper strips private cost snapshots and applies request limits.
create function public.checkout_quote(customer jsonb,lines jsonb,city_index integer,coupon_code text default '') returns jsonb language plpgsql security definer set search_path=public as $$declare q jsonb;begin perform consume_limit('quote:'||coalesce(customer->>'phone','anonymous'),60,60);q:=quote_order(customer,lines,city_index,coupon_code);return q-'items'-'cost_total';end$$;
grant execute on function public.checkout_quote(jsonb,jsonb,integer,text) to anon,authenticated;
create or replace function public.place_order(customer jsonb,lines jsonb,city_index integer,coupon_code text default '') returns jsonb language plpgsql security definer set search_path=public as $$
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
 insert into orders(name,phone,city,address,items,subtotal,delivery,discount,total,region,notes,cost_total,coupon_code,marketing_consent) values(left(customer->>'name',100),v_phone,q->>'city',customer->>'address',q->'items',(q->>'subtotal')::numeric,(q->>'delivery')::numeric,(q->>'discount')::numeric,(q->>'total')::numeric,left(coalesce(customer->>'region',''),100),left(coalesce(customer->>'notes',''),1000),(q->>'cost_total')::numeric,upper(coupon_code),coalesce((customer->>'marketing_consent')::boolean,false)) returning * into o;
 insert into customers(phone,name,marketing_consent) values(v_phone,o.name,o.marketing_consent) on conflict(phone) do update set name=excluded.name,marketing_consent=excluded.marketing_consent,updated_at=now();
 return to_jsonb(o)-'cost_total'-'internal_notes'-'items'||jsonb_build_object('items',(select jsonb_agg(x-'unit_cost') from jsonb_array_elements(o.items) x));
end$$;
-- Optimistic version check prevents overwriting concurrent staff edits.
create function public.edit_order(order_id text,expected_version integer,changes jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
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
 if disc<0 or disc>sub or fee<0 or extra<0 or v_paid<0 or v_paid>sub-disc+fee+extra then raise exception 'Invalid totals';end if;
 update orders set name=left(coalesce(changes->>'name',o.name),100),phone=left(coalesce(changes->>'phone',o.phone),20),address=left(coalesce(changes->>'address',o.address),500),region=left(coalesce(changes->>'region',o.region),100),notes=left(coalesce(changes->>'notes',o.notes),1000),internal_notes=left(coalesce(changes->>'internal_notes',o.internal_notes),1000),courier_id=case when changes ? 'courier_id' then nullif(changes->>'courier_id','')::uuid else o.courier_id end,tracking_number=left(coalesce(changes->>'tracking_number',o.tracking_number),200),status=newstatus,items=clean,subtotal=sub,discount=disc,delivery=fee,extra_fees=extra,total=sub-disc+fee+extra,paid=v_paid,cost_total=cost,expenses=coalesce((changes->>'expenses')::numeric,o.expenses),version=version+1,updated_at=now() where id=o.id returning * into o;
 return to_jsonb(o);
end$$;
revoke all on function public.edit_order(text,integer,jsonb) from public;grant execute on function public.edit_order(text,integer,jsonb) to authenticated;
create or replace function public.admin_update_order(order_id text,new_status text,new_name text,new_phone text,new_address text) returns void language plpgsql security definer set search_path=public as $$declare v integer;begin select version into v from orders where id=order_id;perform edit_order(order_id,v,jsonb_build_object('status',new_status,'name',new_name,'phone',new_phone,'address',new_address));end$$;
create or replace function public.track_order(order_id text,phone_number text) returns jsonb language plpgsql security definer set search_path=public as $$declare o orders%rowtype;begin perform consume_limit('tracking:'||phone_number,20,300);select * into o from orders where id=order_id and phone=phone_number;if not found then return null;end if;return jsonb_build_object('id',o.id,'status',o.status,'created_at',o.created_at,'total',o.total,'paid',o.paid,'tracking_number',o.tracking_number);end$$;
create function public.request_return(order_number text,phone_number text,request_kind text,reason_text text) returns uuid language plpgsql security definer set search_path=public as $$declare result uuid;begin perform consume_limit('return:'||phone_number,5,3600);if length(reason_text) not between 5 and 1000 or not exists(select 1 from orders where id=order_number and phone=phone_number and status in ('delivered','completed')) then raise exception 'Invalid request';end if;insert into return_requests(order_id,kind,reason) values(order_number,request_kind,reason_text) returning id into result;return result;end$$;
revoke all on function public.request_return(text,text,text,text) from public;grant execute on function public.request_return(text,text,text,text) to anon,authenticated;
-- Realtime publishes only rows allowed by orders SELECT RLS.
do $$begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table orders;end if;end$$;
