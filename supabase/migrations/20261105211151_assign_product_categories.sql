create or replace function public.assign_product_categories(category_id text, product_ids text[])
returns integer language plpgsql security invoker set search_path=public as $$
declare affected integer;
begin
 if not public.can('products.write') then raise exception 'Forbidden'; end if;
 if category_id is null or product_ids is null or cardinality(product_ids)=0 or cardinality(product_ids)>5000 or exists(select 1 from unnest(product_ids) x where x is null) or cardinality(product_ids)<>(select count(distinct x) from unnest(product_ids) x) then raise exception 'Invalid products'; end if;
 if not exists(select 1 from public.settings s cross join lateral jsonb_array_elements(s.data->'categories') c where c->>0=category_id and category_id<>'all') then raise exception 'Invalid category'; end if;
 perform id from public.products where id=any(product_ids) order by id for update;
 update public.products set data=jsonb_set(data,'{category}',to_jsonb(category_id),true) where id=any(product_ids);
 get diagnostics affected=row_count;
 if affected<>cardinality(product_ids) then raise exception 'Products changed; reload and try again'; end if;
 return affected;
end $$;
revoke all on function public.assign_product_categories(text,text[]) from public,anon;
grant execute on function public.assign_product_categories(text,text[]) to authenticated;
