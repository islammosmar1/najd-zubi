-- Separate, RLS-protected wholesale membership and pricing; never embed prices in public product JSON.
create table public.wholesale_accounts(id uuid primary key references auth.users(id) on delete cascade,name text not null check(length(name) between 2 and 100),phone text unique not null check(phone ~ '^\+[0-9]{8,15}$'),active boolean not null default true,created_at timestamptz not null default now());
create table public.wholesale_prices(id text primary key references public.products(id) on delete cascade,price numeric(12,2) not null check(price>=0));
alter table public.wholesale_accounts enable row level security;
alter table public.wholesale_prices enable row level security;
grant select on public.wholesale_accounts to authenticated;
grant select,insert,update,delete on public.wholesale_prices to authenticated;
grant all on public.wholesale_accounts,public.wholesale_prices to service_role;
create policy "Wholesale own membership" on public.wholesale_accounts for select to authenticated using(id=auth.uid() or public.can('staff.manage'));
create policy "Wholesale approved prices" on public.wholesale_prices for select to authenticated using(public.can('products.write') or (exists(select 1 from public.wholesale_accounts a where a.id=auth.uid() and a.active) and exists(select 1 from products p where p.id=wholesale_prices.id and p.status='published')));
create policy "Wholesale price managers" on public.wholesale_prices for all to authenticated using(public.can('products.write')) with check(public.can('products.write'));
create trigger wholesale_accounts_audit after insert or update or delete on public.wholesale_accounts for each row execute function public.audit_change();
create trigger wholesale_prices_audit after insert or update or delete on public.wholesale_prices for each row execute function public.audit_change();
create or replace function public.quote_order(customer jsonb,lines jsonb,city_index integer,coupon_code text default '') returns jsonb language plpgsql security definer set search_path=public as $$
declare settings jsonb;city jsonb;line jsonb;prod products%rowtype;cp coupons%rowtype;qty integer;sub numeric:=0;eligible numeric:=0;eligibleqty integer:=0;fee numeric:=0;discount numeric:=0;cost numeric:=0;resultitems jsonb:='[]';region_fee numeric:=0;p_cost numeric;is_wholesale boolean;
begin
 if lines is null or jsonb_typeof(lines)!='array' or jsonb_array_length(lines)<1 or jsonb_array_length(lines)>100 then raise exception 'Invalid cart';end if;
 select exists(select 1 from wholesale_accounts where id=auth.uid() and active) into is_wholesale;
 if is_wholesale and coupon_code!='' then raise exception 'Coupons cannot be combined with wholesale prices';end if;
 select data into settings from store_settings where id=1;
 if city_index is null or city_index<0 or city_index>=jsonb_array_length(settings->'cities') then raise exception 'Invalid city';end if;city:=settings->'cities'->city_index;
 if city is null or city->>'enabled'='false' then raise exception 'Delivery unavailable';end if;
 if coupon_code!='' then select * into cp from coupons c where c.code=upper(coupon_code) and active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()) and (max_uses is null or uses<max_uses) and (customer_phone is null or customer_phone=customer->>'phone');if not found then raise exception 'Coupon not valid';end if;end if;
 for line in select * from jsonb_array_elements(lines) loop
 qty:=(line->>'qty')::integer;if qty is null or qty<1 or qty>999 or (line->>'qty')::numeric!=qty then raise exception 'Invalid quantity';end if;
 select * into prod from products where id=line->>'id' and status='published';if not found then raise exception 'Product unavailable';end if;
 if is_wholesale then select coalesce((select w.price from wholesale_prices w where w.id=prod.id),prod.price) into prod.price;end if;
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

-- Only the trusted Edge Function supplies a verified account ID. Clients cannot call this wrapper.
create function public.place_verified_order(buyer uuid,customer jsonb,lines jsonb,city_index integer,coupon_code text default '') returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if buyer is not null and not exists(select 1 from wholesale_accounts where id=buyer and active) then raise exception 'Wholesale account inactive';end if;
 perform set_config('request.jwt.claim.sub',coalesce(buyer::text,''),true);
 return public.place_order(customer,lines,city_index,coupon_code);
end$$;
revoke all on function public.place_verified_order(uuid,jsonb,jsonb,integer,text) from public,anon,authenticated;
grant execute on function public.place_verified_order(uuid,jsonb,jsonb,integer,text) to service_role;
