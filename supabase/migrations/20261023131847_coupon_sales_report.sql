-- Aggregate on the server so the result is not limited by the browser's order list.
create index if not exists orders_coupon_report_period_idx on public.orders(created_at,coupon_code) where coupon_code<>'';
create or replace function public.coupon_sales_report(date_from date,date_to date)
returns jsonb language plpgsql stable security definer set search_path='' as $body$
declare result jsonb;
begin
 if auth.uid() is null or not public.can('reports.read') then raise exception 'Forbidden' using errcode='42501';end if;
 if date_from is null or date_to is null or date_from>date_to then raise exception 'Invalid date range';end if;
 with codes as (
 select upper(btrim(code)) as code from public.coupons
 union select distinct upper(btrim(coupon_code)) from public.orders where coupon_code<>''
 ), summary as (
 select upper(btrim(o.coupon_code)) as code,
 count(*) filter(where o.status not in ('cancelled','returned')) as orders_count,
 coalesce(sum(o.total-o.delivery) filter(where o.status not in ('cancelled','returned')),0) as net_sales,
 count(*) filter(where o.status in ('delivered','completed')) as delivered_count,
 coalesce(sum(o.total-o.delivery) filter(where o.status in ('delivered','completed')),0) as delivered_sales,
 count(*) filter(where o.status in ('cancelled','returned')) as excluded_count,
 coalesce(sum(o.discount) filter(where o.status not in ('cancelled','returned')),0) as discount_total
 from public.orders o where o.coupon_code<>'' and
 o.created_at >= (date_from::timestamp at time zone 'Asia/Hebron') and
 o.created_at < ((date_to+1)::timestamp at time zone 'Asia/Hebron')
 group by upper(btrim(o.coupon_code))
 )
 select coalesce(jsonb_agg(jsonb_build_object('code',c.code,'orders_count',coalesce(s.orders_count,0),'net_sales',coalesce(s.net_sales,0),'delivered_count',coalesce(s.delivered_count,0),'delivered_sales',coalesce(s.delivered_sales,0),'excluded_count',coalesce(s.excluded_count,0),'discount_total',coalesce(s.discount_total,0)) order by c.code),'[]'::jsonb)
 into result from codes c left join summary s using(code) where c.code<>'';
 return result;
end $body$;
revoke all on function public.coupon_sales_report(date,date) from public,anon,authenticated;
grant execute on function public.coupon_sales_report(date,date) to authenticated;
