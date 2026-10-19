-- Completed purchases retain their verified-review eligibility. Existing grants remain unchanged.
create or replace function public.submit_review(product text,order_number text,phone_number text,rating integer,comment text) returns jsonb language plpgsql security definer set search_path=public as $$
declare o orders%rowtype;r reviews%rowtype;
begin
 select * into o from orders where id=order_number and phone=phone_number and status in ('delivered','completed');
 if not found or not exists(select 1 from jsonb_array_elements(o.items) x where x->>'id'=product) then raise exception 'A delivered purchase of this product is required';end if;
 if rating is null or rating not between 1 and 5 or comment is null or length(btrim(comment))<3 or length(comment)>1000 then raise exception 'Invalid review';end if;
 insert into review_receipts(order_id,product_id) values(o.id,product);
 insert into reviews(product_id,author,score,body) values(product,split_part(o.name,' ',1),rating,comment) returning * into r;
 return to_jsonb(r);
end $$;
