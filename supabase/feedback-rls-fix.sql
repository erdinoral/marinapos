-- Geri bildirim gonderim RLS duzeltmesi
-- Supabase SQL Editor'de bir kez calistirin.

-- Eski / eksik insert politikasi
drop policy if exists app_feedback_anon_insert on public.app_feedback;
create policy app_feedback_anon_insert
  on public.app_feedback for insert
  to anon
  with check (true);

-- Guvenli gonderim RPC (RLS sorunlarini onler)
create or replace function public.submit_app_feedback(
  p_app_code text,
  p_app_version text,
  p_title text,
  p_body text,
  p_contact_name text,
  p_company_name text default null,
  p_image_path text default null
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
    'new'
  )
  returning id into v_id;

  return v_id;
end;
$$;

alter table public.app_feedback
  add column if not exists account_email text;

create index if not exists app_feedback_account_email_idx
  on public.app_feedback (lower(trim(account_email)));

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

-- Gorsel bucket politikasi (eksikse)
insert into storage.buckets (id, name, public)
values ('feedback-images', 'feedback-images', false)
on conflict (id) do nothing;

drop policy if exists feedback_images_anon_insert on storage.objects;
create policy feedback_images_anon_insert
  on storage.objects for insert
  to anon
  with check (bucket_id = 'feedback-images');
