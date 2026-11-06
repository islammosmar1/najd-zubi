alter table public.products add column if not exists created_at timestamptz;
update public.products p set created_at=a.created_at from (select record_id,min(created_at) created_at from public.audit_log where table_name='products' and action='INSERT' group by record_id) a where p.id=a.record_id and p.created_at is null;
alter table public.products alter column created_at set default clock_timestamp();
create or replace function public.preserve_product_creation_time() returns trigger language plpgsql security invoker set search_path=public as $$begin if TG_OP='UPDATE' then NEW.created_at:=OLD.created_at;else NEW.created_at:=clock_timestamp();end if;return NEW;end$$;
create trigger preserve_product_creation_time before insert or update on public.products for each row execute function public.preserve_product_creation_time();
