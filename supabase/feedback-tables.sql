-- Akiyom Supabase: POS geri bildirim (soru / gorus / oneri)
-- SQL Editor'de bir kez calistirin. Lisans tablolariyla ayni projede olabilir.

create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  app_code text not null default 'marina-pos',
  app_name text not null default 'Marina Nargile POS',
  app_version text,
  title text not null,
  body text not null,
  contact_name text not null,
  company_name text,
  account_email text,
  image_path text,
  admin_reply text,
  replied_at timestamptz,
  status text not null default 'new' check (status in ('new', 'read', 'in_progress', 'answered', 'closed'))
);

create index if not exists app_feedback_created_at_idx on public.app_feedback (created_at desc);
create index if not exists app_feedback_status_idx on public.app_feedback (status);
create index if not exists app_feedback_app_code_idx on public.app_feedback (app_code);
create index if not exists app_feedback_account_email_idx
  on public.app_feedback (lower(trim(account_email)));

alter table public.app_feedback enable row level security;

drop policy if exists app_feedback_anon_insert on public.app_feedback;
create policy app_feedback_anon_insert
  on public.app_feedback for insert
  to anon
  with check (true);

-- Okuma: sadece service role (akiyom.com admin) veya authenticated admin kullanicilar
-- Anon SELECT kapali — musteri uygulamasi sadece gonderir.
-- Yanit okuma: guvenli RPC (firma adina gore filtrelenir).

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

insert into storage.buckets (id, name, public)
values ('feedback-images', 'feedback-images', false)
on conflict (id) do nothing;

drop policy if exists feedback_images_anon_insert on storage.objects;
create policy feedback_images_anon_insert
  on storage.objects for insert
  to anon
  with check (bucket_id = 'feedback-images');

-- akiyom.com admin paneli icin (authenticated veya service role ile okuma):
-- select * from app_feedback order by created_at desc;
-- storage: createSignedUrl veya service role download
