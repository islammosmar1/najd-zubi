-- Reorder only; never overwrite prices, inventory or private costs.
create or replace function public.reorder_category_products(category_id text, ordered_ids text[])
returns void language plpgsql security invoker set search_path=public as $$
declare actual_count integer;
begin
 if not public.can('products.write') then raise exception 'Forbidden'; end if;
 if category_id is null or ordered_ids is null or cardinality(ordered_ids)>5000 then raise exception 'Invalid order'; end if;
 perform id from public.products where data->>'category'=category_id order by id for update;
 select count(*) into actual_count from public.products where data->>'category'=category_id;
 if actual_count<>cardinality(ordered_ids) or actual_count<>(select count(distinct x) from unnest(ordered_ids) x) or exists(select 1 from unnest(ordered_ids) x where x is null or not exists(select 1 from public.products p where p.id=x and p.data->>'category'=category_id)) then raise exception 'Category changed; reload products before sorting'; end if;
 update public.products p set data=jsonb_set(p.data,'{sortOrder}',to_jsonb(o.position::integer),true)
 from unnest(ordered_ids) with ordinality o(id,position) where p.id=o.id and p.data->>'category'=category_id;
end $$;
revoke all on function public.reorder_category_products(text,text[]) from public,anon;
grant execute on function public.reorder_category_products(text,text[]) to authenticated;
