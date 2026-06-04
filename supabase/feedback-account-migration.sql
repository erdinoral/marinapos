-- Hesap profili: geri bildirimleri kullanici e-postasina bagla
-- SQL Editor'de bir kez calistirin (feedback-tables.sql sonrasi).

alter table public.app_feedback
  add column if not exists account_email text;

create index if not exists app_feedback_account_email_idx
  on public.app_feedback (lower(trim(account_email)));

drop function if exists public.get_app_feedback_for_account(text, text);

create or replace function public.get_app_feedback_for_account(
  p_app_code text,
  p_account_email text
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
    and lower(trim(coalesce(f.account_email, ''))) = lower(trim(coalesce(p_account_email, '')))
    and trim(coalesce(p_account_email, '')) <> ''
  order by coalesce(f.replied_at, f.created_at) desc
  limit 80;
$$;

revoke all on function public.get_app_feedback_for_account(text, text) from public;
grant execute on function public.get_app_feedback_for_account(text, text) to anon;
grant execute on function public.get_app_feedback_for_account(text, text) to authenticated;

-- submit_app_feedback: account_email parametresi (eski imzayi kaldirin)
drop function if exists public.submit_app_feedback(text, text, text, text, text, text, text);
drop function if exists public.submit_app_feedback(text, text, text, text, text, text, text, text);

create or replace function public.submit_app_feedback(
  p_app_code text,
  p_app_version text,
  p_title text,
  p_body text,
  p_contact_name text,
  p_company_name text default null,
  p_image_path text default null,
  p_account_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if trim(coalesce(p_title, '')) = '' then
    raise exception 'Baslik gerekli.';
  end if;
  if trim(coalesce(p_body, '')) = '' then
    raise exception 'Sorun / aciklama gerekli.';
  end if;
  if trim(coalesce(p_contact_name, '')) = '' then
    raise exception 'Isim gerekli.';
  end if;

  insert into public.app_feedback (
    app_code,
    app_version,
    app_name,
    title,
    body,
    contact_name,
    company_name,
    image_path,
    account_email,
    status
  ) values (
    lower(trim(coalesce(nullif(trim(p_app_code), ''), 'marina-pos'))),
    nullif(trim(coalesce(p_app_version, '')), ''),
    'Marina Nargile POS',
    trim(p_title),
    trim(p_body),
    trim(p_contact_name),
    nullif(trim(coalesce(p_company_name, '')), ''),
    nullif(trim(coalesce(p_image_path, '')), ''),
    nullif(lower(trim(coalesce(p_account_email, ''))), ''),
    'new'
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_app_feedback(text, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_app_feedback(text, text, text, text, text, text, text, text) to anon;
grant execute on function public.submit_app_feedback(text, text, text, text, text, text, text, text) to authenticated;
