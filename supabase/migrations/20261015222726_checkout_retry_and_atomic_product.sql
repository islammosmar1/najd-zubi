-- One transaction for public product data and private prices. Existing RLS stays enforced.
create or replace function public.save_product_atomic(product jsonb, wholesale_price numeric default null, change_wholesale boolean default false)
returns void language plpgsql security invoker set search_path=public as $$
declare product_id text:=product->>'id'; retail numeric:=(product->>'price')::numeric; purchase_cost numeric:=coalesce((product->>'cost')::numeric,0); quantity integer:=(product->>'stock')::integer;
begin
 if not public.can('products.write') then raise exception 'Forbidden';end if;
 if product_id is null or length(product_id) not between 1 and 100 or length(btrim(coalesce(product->'name'->>'ar','')))<1 or jsonb_typeof(product->'images') is distinct from 'array' or jsonb_array_length(product->'images')<1 then raise exception 'Invalid product';end if;
 if retail is null or retail<0 or retail::text in ('NaN','Infinity','-Infinity') or purchase_cost<0 or purchase_cost::text in ('NaN','Infinity','-Infinity') or quantity is null or quantity<0 or quantity::numeric<>(product->>'stock')::numeric then raise exception 'Invalid product price or stock';end if;
 if wholesale_price is not null and (wholesale_price<0 or wholesale_price::text in ('NaN','Infinity','-Infinity')) then raise exception 'Invalid wholesale price';end if;
 if product->>'isSample'='true' then quantity:=0;end if;
 insert into products(id,price,stock,status,sku,barcode,data) values(product_id,retail,quantity,coalesce(product->>'status','draft'),nullif(product->>'sku',''),nullif(product->>'barcode',''),(product-'cost'-'wholesalePrice'-'wholesale_price'-'retailPrice'-'wholesale')||jsonb_build_object('stock',quantity))
 on conflict(id) do update set price=excluded.price,stock=excluded.stock,status=excluded.status,sku=excluded.sku,barcode=excluded.barcode,data=excluded.data,updated_at=now();
 insert into product_costs(id,cost) values(product_id,purchase_cost) on conflict(id) do update set cost=excluded.cost;
 if change_wholesale then
  if wholesale_price is null then delete from wholesale_prices where id=product_id;
  else insert into wholesale_prices(id,price) values(product_id,wholesale_price) on conflict(id) do update set price=excluded.price;end if;
 end if;
 delete from product_drafts where id=product_id;
end $$;
revoke all on function public.save_product_atomic(jsonb,numeric,boolean) from public,anon;
grant execute on function public.save_product_atomic(jsonb,numeric,boolean) to authenticated;

-- Not exposed through the Data API; no client grants or policies.
create table if not exists najd_private.checkout_attempts(request_id uuid primary key, fingerprint text not null, response jsonb, created_at timestamptz not null default now());
alter table najd_private.checkout_attempts enable row level security;
revoke all on najd_private.checkout_attempts from public,anon,authenticated;
create or replace function public.place_order_once(request_id uuid,buyer uuid,customer jsonb,lines jsonb,city_index integer,coupon_code text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare fingerprint_value text; previous najd_private.checkout_attempts%rowtype; result jsonb;
begin
 if request_id is null then raise exception 'Request ID required';end if;
 if buyer is not null and not exists(select 1 from public.wholesale_accounts where id=buyer and active) then raise exception 'Wholesale account inactive';end if;
 fingerprint_value:=encode(sha256(convert_to(jsonb_build_object('buyer',buyer,'customer',customer,'lines',lines,'city',city_index,'coupon',coupon_code)::text,'UTF8')),'hex');
 insert into najd_private.checkout_attempts(request_id,fingerprint) values(request_id,fingerprint_value) on conflict do nothing;
 select * into previous from najd_private.checkout_attempts a where a.request_id=place_order_once.request_id for update;
 if previous.fingerprint<>fingerprint_value then raise exception 'Request ID already used with different checkout details';end if;
 if previous.response is not null then return previous.response;end if;
 result:=public.place_verified_order(buyer,customer,lines,city_index,coupon_code);
 update najd_private.checkout_attempts a set response=result where a.request_id=place_order_once.request_id;
 return result;
end $$;
revoke all on function public.place_order_once(uuid,uuid,jsonb,jsonb,integer,text) from public,anon,authenticated;
grant execute on function public.place_order_once(uuid,uuid,jsonb,jsonb,integer,text) to service_role;
