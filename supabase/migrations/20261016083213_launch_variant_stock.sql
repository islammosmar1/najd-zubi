-- Optional inventory by color and size. Existing products remain unchanged.
create or replace function najd_private.validate_variant_inventory() returns trigger language plpgsql security invoker set search_path=public as $$
declare v jsonb;total integer:=0; variants jsonb:=new.data->'variants';
begin
 if tg_op='UPDATE' and old.data->'variants' is not null and old.data->'variants'<>'null'::jsonb and exists(select 1 from jsonb_array_elements(old.data->'variants') prior where not exists(select 1 from jsonb_array_elements(coalesce(nullif(variants,'null'::jsonb),'[]')) candidate where candidate->>'color'=prior->>'color' and candidate->>'size'=prior->>'size')) then raise exception 'Keep saved variants for order history; set stock to zero instead';end if;
 if variants is null or variants='null'::jsonb then return new;end if;
 if jsonb_typeof(variants)<>'array' or jsonb_array_length(variants)<1 or jsonb_array_length(variants)>100 then raise exception 'Invalid variant inventory';end if;
 for v in select * from jsonb_array_elements(variants) loop
  if jsonb_typeof(v->'color')<>'string' or jsonb_typeof(v->'size')<>'string' or v->>'color' is null or v->>'size' is null or (v->>'stock') is null or (v->>'stock')::numeric<0 or (v->>'stock')::numeric<>trunc((v->>'stock')::numeric) then raise exception 'Invalid variant inventory';end if;
  if not(coalesce(new.data->'sizes','["Standard"]') ? (v->>'size')) or (jsonb_array_length(coalesce(new.data->'colors','[]'))>0 and not(new.data->'colors' ? (v->>'color'))) or (jsonb_array_length(coalesce(new.data->'colors','[]'))=0 and v->>'color'<>'') then raise exception 'Variant does not match product options';end if;
  total:=total+(v->>'stock')::integer;
 end loop;
 if (select count(distinct (x->>'color',x->>'size')) from jsonb_array_elements(variants) x)<>jsonb_array_length(variants) then raise exception 'Duplicate variant';end if;
 if new.data->>'isSample'='true' and total<>0 then raise exception 'Sample inventory must be zero';end if;
 if tg_op='INSERT' or variants is distinct from old.data->'variants' then new.stock:=total;end if;
 return new;
end $$;
revoke all on function najd_private.validate_variant_inventory() from public,anon,authenticated;
create trigger products_variant_validation before insert or update on public.products for each row execute function najd_private.validate_variant_inventory();

-- Existing order functions lock products and update aggregate stock first.
-- This trigger updates only option inventory in the same transaction; failures roll back everything.
create or replace function najd_private.reserve_order_variants() returns trigger language plpgsql security invoker set search_path=public as $$
declare previous jsonb:='[]';nextlines jsonb:='[]';p products%rowtype;v jsonb;updated jsonb;delta integer;qty integer;line record;
begin
 if tg_op='UPDATE' and old.status not in ('cancelled','returned') then previous:=old.items;end if;
 if new.status not in ('cancelled','returned') then nextlines:=new.items;end if;
 for p in select * from products where id in(select x->>'id' from jsonb_array_elements(previous||nextlines) x) order by id for update loop
  if p.data->'variants' is null or p.data->'variants'='null'::jsonb then continue;end if;
  updated:=p.data->'variants';
  for line in select x->>'color' color,coalesce(x->>'size','Standard') size from jsonb_array_elements(previous||nextlines) x where x->>'id'=p.id group by 1,2 loop
   select coalesce(sum((x->>'qty')::integer),0) into delta from jsonb_array_elements(nextlines) x where x->>'id'=p.id and coalesce(x->>'color','')=coalesce(line.color,'') and coalesce(x->>'size','Standard')=line.size;
   select delta-coalesce(sum((x->>'qty')::integer),0) into delta from jsonb_array_elements(previous) x where x->>'id'=p.id and coalesce(x->>'color','')=coalesce(line.color,'') and coalesce(x->>'size','Standard')=line.size;
   if delta=0 then continue;end if;
   select (x->>'stock')::integer into qty from jsonb_array_elements(updated) x where x->>'color'=coalesce(line.color,'') and x->>'size'=line.size;
   if qty is null then
    if delta>0 then raise exception 'Product option unavailable';end if;
    -- Returning a retired option restores it for a manager to review.
    updated:=updated||jsonb_build_array(jsonb_build_object('color',coalesce(line.color,''),'size',line.size,'stock',-delta));
   else
    if qty<delta then raise exception 'Insufficient variant stock';end if;
    select jsonb_agg(case when x->>'color'=coalesce(line.color,'') and x->>'size'=line.size then jsonb_set(x,'{stock}',to_jsonb(qty-delta)) else x end order by n) into updated from jsonb_array_elements(updated) with ordinality a(x,n);
   end if;
  end loop;
  update products set data=jsonb_set(data,'{variants}',updated) where id=p.id;
 end loop;
 return new;
end $$;
revoke all on function najd_private.reserve_order_variants() from public,anon,authenticated;
create trigger orders_variant_reservation after insert or update of items,status on public.orders for each row execute function najd_private.reserve_order_variants();

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
 return jsonb_build_object('subtotal',sub,'discount',discount,'delivery',fee,'total',sub-discount+fee,'items',resultitems,'cost_total',cost,'city',city->>'name');
end $$;

revoke all on function public.quote_order(jsonb,jsonb,integer,text) from public,anon,authenticated;
