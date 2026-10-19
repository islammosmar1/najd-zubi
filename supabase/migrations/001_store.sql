-- NAJD COSMETICS: run in a new Supabase project's SQL editor.
create extension if not exists pgcrypto;
create table public.admins(id uuid primary key references auth.users(id) on delete cascade);
alter table public.admins enable row level security;
create policy "Own admin membership" on public.admins for select to authenticated using(id=auth.uid());
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.admins where id=auth.uid()) $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
create table public.products(id text primary key, price numeric(12,2) not null check(price>=0),stock integer not null default 0 check(stock>=0),data jsonb not null);
alter table public.products enable row level security;
create policy "Public catalog" on public.products for select using(true);
create policy "Admin catalog" on public.products for all to authenticated using(public.is_admin()) with check(public.is_admin());
create table public.product_costs(id text primary key references products(id) on delete cascade,cost numeric(12,2) not null default 0 check(cost>=0));
alter table public.product_costs enable row level security;
create policy "Admin costs" on public.product_costs for all to authenticated using(public.is_admin()) with check(public.is_admin());
create table public.store_settings(id integer primary key check(id=1),data jsonb not null);
alter table public.store_settings enable row level security;
create policy "Public settings" on public.store_settings for select using(true);
create policy "Admin settings" on public.store_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());
create table public.orders(id text primary key default 'NJD-'||upper(encode(gen_random_bytes(10),'hex')),created_at timestamptz not null default now(),name text not null,phone text not null,city text not null,address text not null,items jsonb not null,subtotal numeric(12,2) not null,delivery numeric(12,2) not null,discount numeric(12,2) not null,total numeric(12,2) not null,status text not null default 'new' check(status in ('new','confirmed','shipped','delivered','cancelled')),payment text not null default 'cash');
alter table public.orders enable row level security;
create policy "Admin orders read" on public.orders for select to authenticated using(public.is_admin());
-- Order writes are only through functions: prices, discounts and stock are server-owned.
create function public.place_order(customer jsonb,lines jsonb,city_index integer,coupon_code text default '') returns jsonb language plpgsql security definer set search_path=public as $$
declare config jsonb; citydata jsonb; item jsonb; prod public.products%rowtype; o public.orders%rowtype; cleanitems jsonb:='[]'; qty integer; totalqty integer; sub numeric:=0; disc numeric:=0; rate numeric:=0; fee numeric; cname text; cphone text; caddress text; optioncolor text; optionsize text;
begin
 cname:=btrim(customer->>'name');cphone:=btrim(customer->>'phone');caddress:=btrim(customer->>'address');
 if cname is null or length(cname)<2 or length(cname)>100 or cphone is null or cphone !~ '^[+0-9 ()-]{8,20}$' or caddress is null or length(caddress)<5 or length(caddress)>500 then raise exception 'Invalid customer details';end if;
 if jsonb_typeof(lines)!='array' or jsonb_array_length(lines)<1 or jsonb_array_length(lines)>50 then raise exception 'Invalid cart';end if;
 select data into config from store_settings where id=1;
 if city_index is null or city_index<0 or city_index>=jsonb_array_length(config->'cities') then raise exception 'Invalid delivery city';end if;
 citydata:=config->'cities'->city_index;fee:=(citydata->>'fee')::numeric;
 if fee is null or fee<0 then raise exception 'Delivery unavailable';end if;
 -- Acquire locks in stable order, grouping variants to prevent overselling.
 for item in select jsonb_build_object('id',x->>'id','qty',sum((x->>'qty')::integer)) from jsonb_array_elements(lines) x group by x->>'id' order by x->>'id' loop
   select * into prod from products where id=item->>'id' for update;
   if not found then raise exception 'Product not found';end if;
   totalqty:=(item->>'qty')::integer;
   if totalqty<1 or totalqty>99 or totalqty>prod.stock then raise exception 'Insufficient stock';end if;
 end loop;
 for item in select * from jsonb_array_elements(lines) loop
  qty:=(item->>'qty')::integer;if qty<1 or qty>99 or (item->>'qty')::numeric!=qty then raise exception 'Invalid quantity';end if;
  select * into prod from products where id=item->>'id';
  optioncolor:=coalesce(item->>'color','');optionsize:=coalesce(item->>'size','Standard');
  if jsonb_array_length(coalesce(prod.data->'colors','[]'))>0 and not (prod.data->'colors' ? optioncolor) then raise exception 'Invalid color';end if;
  if not (coalesce(prod.data->'sizes','["Standard"]') ? optionsize) then raise exception 'Invalid size';end if;
  sub:=sub+prod.price*qty;
  cleanitems:=cleanitems||jsonb_build_array(jsonb_build_object('id',prod.id,'qty',qty,'color',optioncolor,'size',optionsize,'price',prod.price,'product',jsonb_build_object('id',prod.id,'name',prod.data->'name','images',prod.data->'images','price',prod.price)));
  update products set stock=stock-qty where id=prod.id;
 end loop;
 if coupon_code!='' then select (x->>'percent')::numeric into rate from jsonb_array_elements(config->'coupons') x where upper(x->>'code')=upper(coupon_code) limit 1;end if;
 rate:=coalesce(rate,0);if rate<0 or rate>100 then raise exception 'Invalid coupon';end if;disc:=round(sub*rate/100,2);
 insert into orders(name,phone,city,address,items,subtotal,delivery,discount,total) values(cname,cphone,citydata->>'name',caddress,cleanitems,sub,fee,disc,sub-disc+fee) returning * into o;
 return to_jsonb(o);
end $$;
revoke all on function public.place_order(jsonb,jsonb,integer,text) from public;
grant execute on function public.place_order(jsonb,jsonb,integer,text) to anon,authenticated;
create function public.track_order(order_id text,phone_number text) returns jsonb language sql security definer set search_path=public as $$select jsonb_build_object('id',id,'status',status,'created_at',created_at,'total',total) from orders where id=order_id and phone=phone_number limit 1$$;
revoke all on function public.track_order(text,text) from public;
grant execute on function public.track_order(text,text) to anon,authenticated;
create function public.admin_update_order(order_id text,new_status text,new_name text,new_phone text,new_address text) returns void language plpgsql security definer set search_path=public as $$
declare o orders%rowtype;item jsonb;
begin
 if not public.is_admin() then raise exception 'Forbidden';end if;
 select * into o from orders where id=order_id for update;if not found then raise exception 'Not found';end if;
 if new_status not in ('new','confirmed','shipped','delivered','cancelled') then raise exception 'Invalid status';end if;
 if o.status='cancelled' and new_status!='cancelled' then raise exception 'Cancelled orders cannot be reopened; create a new order';end if;
 if o.status!='cancelled' and new_status='cancelled' then for item in select * from jsonb_array_elements(o.items) loop update products set stock=stock+(item->>'qty')::integer where id=item->>'id';end loop;end if;
 update orders set status=new_status,name=left(new_name,100),phone=left(new_phone,20),address=left(new_address,500) where id=order_id;
end $$;
revoke all on function public.admin_update_order(text,text,text,text,text) from public;
grant execute on function public.admin_update_order(text,text,text,text,text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('products','products',true,4194304,array['image/jpeg','image/png','image/webp']);
create policy "Read product images" on storage.objects for select using(bucket_id='products');
create policy "Admin image uploads" on storage.objects for insert to authenticated with check(bucket_id='products' and public.is_admin());
create policy "Admin image updates" on storage.objects for update to authenticated using(bucket_id='products' and public.is_admin()) with check(bucket_id='products' and public.is_admin());
create policy "Admin image delete" on storage.objects for delete to authenticated using(bucket_id='products' and public.is_admin());
-- In the SQL editor only, after creating your Auth user:
-- insert into public.admins(id) values ('YOUR_AUTH_USER_UUID');

create table public.reviews(id uuid primary key default gen_random_uuid(),product_id text not null references products(id) on delete cascade,author text not null,score integer not null check(score between 1 and 5),body text not null,created_at timestamptz not null default now());
create table public.review_receipts(order_id text references orders(id),product_id text references products(id) on delete cascade,primary key(order_id,product_id));
alter table public.reviews enable row level security;
alter table public.review_receipts enable row level security;
create policy "Read verified reviews" on public.reviews for select using(true);
create policy "Admin review moderation" on public.reviews for delete to authenticated using(public.is_admin());
create function public.submit_review(product text,order_number text,phone_number text,rating integer,comment text) returns jsonb language plpgsql security definer set search_path=public as $$
declare o orders%rowtype;r reviews%rowtype;
begin
 select * into o from orders where id=order_number and phone=phone_number and status='delivered';
 if not found or not exists(select 1 from jsonb_array_elements(o.items) x where x->>'id'=product) then raise exception 'A delivered purchase of this product is required';end if;
 if rating not between 1 and 5 or length(comment)<3 or length(comment)>1000 then raise exception 'Invalid review';end if;
 insert into review_receipts(order_id,product_id) values(o.id,product);
 insert into reviews(product_id,author,score,body) values(product,split_part(o.name,' ',1),rating,comment) returning * into r;
 return to_jsonb(r);
end $$;
revoke all on function public.submit_review(text,text,text,integer,text) from public;
grant execute on function public.submit_review(text,text,text,integer,text) to anon,authenticated;
