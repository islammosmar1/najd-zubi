-- Local audit fix. Apply only after staging validation and explicit production approval.
-- Order line snapshots use JSON rather than a foreign key. Preserve their inventory
-- reference even when the deleting employee cannot read customer orders through RLS.
create or replace function najd_private.protect_ordered_product()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.orders o where o.items @> jsonb_build_array(jsonb_build_object('id',old.id))) then
  raise exception 'Archive products referenced by orders instead of deleting them';
 end if;
 return old;
end $$;
revoke all on function najd_private.protect_ordered_product() from public,anon,authenticated;
create trigger products_preserve_order_history before delete on public.products
for each row execute function najd_private.protect_ordered_product();

-- Check the final transaction state, not the intermediate aggregate decrement
-- performed before the order's option-reservation trigger.
create or replace function najd_private.check_variant_total()
returns trigger language plpgsql security invoker set search_path='' as $$
declare current_product public.products%rowtype; expected numeric;
begin
 select * into current_product from public.products where id=new.id;
 if not found or current_product.data->'variants' is null or current_product.data->'variants'='null'::jsonb then return null;end if;
 select coalesce(sum((v->>'stock')::numeric),0) into expected from jsonb_array_elements(current_product.data->'variants') v;
 if current_product.stock<>expected then raise exception 'Variant stock total mismatch';end if;
 return null;
end $$;
revoke all on function najd_private.check_variant_total() from public,anon,authenticated;
create constraint trigger products_variant_total_consistent after insert or update on public.products
 deferrable initially deferred for each row execute function najd_private.check_variant_total();
