CREATE OR REPLACE FUNCTION public.quote_order(customer jsonb, lines jsonb, city_index integer, coupon_code text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare settings jsonb;city jsonb;line jsonb;prod products%rowtype;cp coupons%rowtype;qty integer;sub numeric:=0;eligible numeric:=0;eligibleqty integer:=0;fee numeric:=0;discount numeric:=0;cost numeric:=0;resultitems jsonb:='[]';region_fee numeric:=0;p_cost numeric;is_wholesale boolean;wrap_fee numeric:=0;wrap_selected boolean:=false;wrap_unit numeric:=0;line_wrap boolean;
begin
 if lines is null or jsonb_typeof(lines)!='array' or jsonb_array_length(lines)<1 or jsonb_array_length(lines)>100 then raise exception 'Invalid cart';end if;
 select exists(select 1 from wholesale_accounts where id=auth.uid() and active) into is_wholesale;
 if is_wholesale and coupon_code!='' then raise exception 'Coupons cannot be combined with wholesale prices';end if;
 select data into settings from store_settings where id=1;
 if coalesce(customer->>'gift_wrap','false')='true' then raise exception 'Refresh checkout and select wrapping per item';end if;
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
 line_wrap:=coalesce(line->>'gift_wrap','false')='true';wrap_unit:=0;
 if line_wrap then
 if coalesce(settings->'giftWrap'->>'enabled','true')!='true' then raise exception 'Gift wrapping unavailable';end if;
 wrap_unit:=coalesce((settings->'giftWrap'->>'fee')::numeric,5);
 if wrap_unit<0 or wrap_unit>1000 or wrap_unit='NaN'::numeric then raise exception 'Invalid wrapping fee';end if;
 wrap_unit:=round(wrap_unit,2);wrap_fee:=wrap_fee+wrap_unit*qty;if wrap_fee>1000 then raise exception 'Gift wrapping total exceeds limit';end if;wrap_selected:=true;
 end if;
 sub:=sub+prod.price*qty;select coalesce(c.cost,0) into p_cost from product_costs c where c.id=prod.id;cost:=cost+coalesce(p_cost,0)*qty;
 if cp.id is not null and (cardinality(cp.product_ids)=0 or prod.id=any(cp.product_ids)) and (cardinality(cp.category_ids)=0 or prod.data->>'category'=any(cp.category_ids)) then eligible:=eligible+prod.price*qty;eligibleqty:=eligibleqty+qty;end if;
 resultitems:=resultitems||jsonb_build_array(jsonb_build_object('id',prod.id,'qty',qty,'gift_wrap',line_wrap,'gift_wrap_unit_fee',wrap_unit,'gift_wrap_fee',wrap_unit*qty,'price',prod.price,'unit_cost',coalesce(p_cost,0),'color',coalesce(line->>'color',''),'size',coalesce(line->>'size','Standard'),'product',jsonb_build_object('id',prod.id,'name',prod.data->'name','images',prod.data->'images','price',prod.price)));
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
CREATE OR REPLACE FUNCTION public.edit_order(order_id text, expected_version integer, changes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o orders%rowtype;item jsonb;p products%rowtype;newlines jsonb;clean jsonb:='[]';newstatus text;old_reserved boolean;new_reserved boolean;qty integer;oldqty integer;newqty integer;price numeric;unitcost numeric;sub numeric:=0;cost numeric:=0;disc numeric;fee numeric;extra numeric;v_paid numeric;wrap_total numeric:=0;wrap_unit numeric:=0;wrap_selected boolean:=false;per_item_wrap boolean;oldline jsonb;
begin
 if not public.can('orders.write') then raise exception 'Forbidden';end if;
 select * into o from orders where id=order_id for update;if not found then raise exception 'Order not found';end if;if o.version!=expected_version then raise exception 'Order changed; refresh before saving';end if;
 per_item_wrap:=exists(select 1 from jsonb_array_elements(o.items) x where x ? 'gift_wrap_unit_fee');
 if not per_item_wrap then wrap_total:=coalesce(o.gift_wrap_fee,0);end if;
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
 wrap_unit:=0;wrap_selected:=false;
 if per_item_wrap then
 select x into oldline from jsonb_array_elements(o.items) x where x->>'id'=p.id and coalesce(x->>'color','')=coalesce(item->>'color','') and coalesce(x->>'size','Standard')=coalesce(item->>'size','Standard') limit 1;
 wrap_selected:=coalesce(oldline->>'gift_wrap','false')='true';
 if wrap_selected then wrap_unit:=coalesce((oldline->>'gift_wrap_unit_fee')::numeric,0);end if;
 wrap_total:=wrap_total+wrap_unit*qty;
 end if;
 sub:=sub+qty*price;cost:=cost+qty*unitcost;clean:=clean||jsonb_build_array(jsonb_build_object('id',p.id,'qty',qty,'gift_wrap',wrap_selected,'gift_wrap_unit_fee',wrap_unit,'gift_wrap_fee',wrap_unit*qty,'price',price,'unit_cost',unitcost,'color',item->>'color','size',item->>'size','product',jsonb_build_object('name',p.data->'name','images',p.data->'images','price',price)));
 end loop;
 if not per_item_wrap then select jsonb_agg(x-'gift_wrap'-'gift_wrap_unit_fee'-'gift_wrap_fee') into clean from jsonb_array_elements(clean) x;end if;
 disc:=coalesce((changes->>'discount')::numeric,o.discount);fee:=coalesce((changes->>'delivery')::numeric,o.delivery);extra:=coalesce((changes->>'extra_fees')::numeric,o.extra_fees);v_paid:=coalesce((changes->>'paid')::numeric,o.paid);
 if disc<0 or disc>sub or fee<0 or extra<0 or v_paid<0 or v_paid>sub-disc+fee+extra+wrap_total then raise exception 'Invalid totals';end if;
 update orders set name=left(coalesce(changes->>'name',o.name),100),phone=left(coalesce(changes->>'phone',o.phone),20),address=left(coalesce(changes->>'address',o.address),500),region=left(coalesce(changes->>'region',o.region),100),notes=left(coalesce(changes->>'notes',o.notes),1000),internal_notes=left(coalesce(changes->>'internal_notes',o.internal_notes),1000),courier_id=case when changes ? 'courier_id' then nullif(changes->>'courier_id','')::uuid else o.courier_id end,tracking_number=left(coalesce(changes->>'tracking_number',o.tracking_number),200),status=newstatus,items=clean,gift_wrap_fee=wrap_total,gift_wrap=case when per_item_wrap then exists(select 1 from jsonb_array_elements(clean) x where x->>'gift_wrap'='true') else o.gift_wrap end,subtotal=sub,discount=disc,delivery=fee,extra_fees=extra,total=sub-disc+fee+extra+wrap_total,paid=v_paid,cost_total=cost,expenses=coalesce((changes->>'expenses')::numeric,o.expenses),version=version+1,updated_at=now() where id=o.id returning * into o;
 return to_jsonb(o);
end$function$
;