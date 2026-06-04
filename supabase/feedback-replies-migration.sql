-- Mevcut app_feedback tablosuna yanit alanlari + okuma RPC
-- feedback-tables.sql daha once calistirildiysa bunu bir kez calistirin.

alter table public.app_feedback add column if not exists admin_reply text;
alter table public.app_feedback add column if not exists replied_at timestamptz;

drop function if exists public.get_app_feedback_replies(text, text);

create or replace function public.get_app_feedback_replies(
  p_app_code text,
  p_company_name text
)
returns table (
  id uuid,
  created_at timestamptz,
  title text,
  body text,
  contact_name text,
  status text,
  admin_reply text,
  replied_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    f.id,
    f.created_at,
    f.title,
    f.body,
    f.contact_name,
    f.status,
    f.admin_reply,
    f.replied_at
  from public.app_feedback f
  where lower(trim(f.app_code)) = lower(trim(coalesce(p_app_code, '')))
    and trim(coalesce(f.company_name, '')) = trim(coalesce(p_company_name, ''))
  order by coalesce(f.replied_at, f.created_at) desc
  limit 50;
$$;

revoke all on function public.get_app_feedback_replies(text, text) from public;
grant execute on function public.get_app_feedback_replies(text, text) to anon;
grant execute on function public.get_app_feedback_replies(text, text) to authenticated;
