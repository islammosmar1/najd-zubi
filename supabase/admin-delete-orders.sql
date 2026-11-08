create or replace function public.delete_order(order_id text, expected_version integer) returns text language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype;
begin
 if not public.can('orders.write') then raise exception 'Forbidden'; end if;
 select * into o from public.orders where id=order_id for update;
 if not found then raise exception 'Order not found'; end if;
 if o.version is distinct from expected_version then raise exception 'Order changed; refresh before deleting'; end if;
 if exists(select 1 from public.review_receipts where review_receipts.order_id=o.id) or exists(select 1 from public.return_requests where return_requests.order_id=o.id) then raise exception 'Cannot delete an order linked to reviews or returns'; end if;
 if o.status not in ('cancelled','returned','delivered','completed') then
 perform 1 from public.products where id in(select x->>'id' from jsonb_array_elements(o.items) x) order by id for update;
 update public.products p set stock=p.stock+q.qty from (select x->>'id' id,sum((x->>'qty')::integer)::integer qty from jsonb_array_elements(o.items) x group by x->>'id') q where p.id=q.id;
 end if;
 delete from public.orders where id=o.id;
 return o.id;
end $$;
revoke all on function public.delete_order(text,integer) from public,anon;
grant execute on function public.delete_order(text,integer) to authenticated;