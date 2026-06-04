-- Panel durumlari: Yeni, Okundu, Yapim asamasinda, Yanitlandi, Kapandi
-- Supabase SQL Editor'de bir kez calistirin.
-- Hata: "check constraint ... is violated by some row" -> once constraint kaldirilir, tum satirlar duzeltilir.

-- 1) Mevcut constraint'i kaldir (bozuk / eski degerler serbest kalir)
alter table public.app_feedback drop constraint if exists app_feedback_status_check;

-- 2) Panelden gelen tum varyantlari standart anahtarlara cevir
update public.app_feedback
set status = case
  when status is null or trim(status) = '' then 'new'
  when lower(trim(status)) in ('new', 'yeni') then 'new'
  when lower(trim(status)) in ('read', 'okundu') then 'read'
  when lower(trim(status)) in ('in_progress', 'in progress', 'yapim_asamasinda', 'yapim asamasinda') then 'in_progress'
  when lower(trim(status)) in ('answered', 'replied', 'resolved', 'yanitlandi', 'yanitlandı') then 'answered'
  when lower(trim(status)) in ('closed', 'kapandi', 'kapandı') then 'closed'
  when status ilike 'yap%m%' and status ilike '%asam%' then 'in_progress'
  when status ilike 'yan%t%' then 'answered'
  when status ilike 'kapan%' then 'closed'
  when status ilike 'okun%' then 'read'
  when status ilike 'yen%' then 'new'
  when status in ('new', 'read', 'in_progress', 'answered', 'closed') then status
  else 'new'
end;

-- 3) Hala tanimsiz kalan varsa Yeni yap
update public.app_feedback
set status = 'new'
where status not in ('new', 'read', 'in_progress', 'answered', 'closed');

-- 4) Yeni constraint
alter table public.app_feedback add constraint app_feedback_status_check
  check (status in ('new', 'read', 'in_progress', 'answered', 'closed'));

-- 5) RPC: donus tipi degistiysa once sil, sonra yeniden olustur
drop function if exists public.get_app_feedback_replies(text, text);

create function public.get_app_feedback_replies(
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

-- Kontrol (istege bagli):
-- select status, count(*) from public.app_feedback group by status order by status;
