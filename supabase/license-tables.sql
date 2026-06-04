-- =============================================================================
-- Akiyom POS lisans temeli (tum masaustu / POS uygulamalari icin ortak)
-- Siz: yalnizca pos_licenses tablosuna satir eklersiniz.
-- Uygulama: anahtari bir kez girer, her acilista bu tabloya bakar.
-- =============================================================================

create table if not exists public.pos_license_config (
  id int primary key default 1 check (id = 1),
  global_lock boolean not null default false,
  global_message text,
  offline_grace_days int not null default 7,
  updated_at timestamptz not null default now()
);

insert into public.pos_license_config (id, global_lock, global_message, offline_grace_days)
values (1, false, null, 7)
on conflict (id) do nothing;

-- Ana lisans listesi (Table Editor'da "Lisanslar" gibi kullanin)
create table if not exists public.pos_licenses (
  license_key text primary key,
  app_code text not null,
  device_id text,
  locked boolean not null default false,
  message text,
  valid_until date,
  firm_name text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pos_licenses_app_code_idx on public.pos_licenses (app_code);

alter table public.pos_license_config enable row level security;
alter table public.pos_licenses enable row level security;

drop policy if exists "pos_anon_read_config" on public.pos_license_config;
create policy "pos_anon_read_config"
  on public.pos_license_config for select to anon using (true);

drop policy if exists "pos_anon_read_licenses" on public.pos_licenses;
create policy "pos_anon_read_licenses"
  on public.pos_licenses for select to anon using (true);

drop policy if exists "pos_anon_bind_license" on public.pos_licenses;
create policy "pos_anon_bind_license"
  on public.pos_licenses for update to anon
  using (device_id is null)
  with check (device_id is not null);

comment on table public.pos_licenses is 'POS/yazilim lisans anahtarlari; app_code ile uygulama ayrilir';
comment on column public.pos_licenses.app_code is 'Orn. marina-pos, cafe-pos — her uygulama kendi kodunu kullanir';
comment on column public.pos_licenses.license_key is 'Musteriye verilen anahtar; uygulamada bir kez girilir';
comment on column public.pos_licenses.device_id is 'Ilk aktivasyonda doldurulur; baska PC engeli';

-- Ornek (test) — silip kendi anahtarinizi ekleyin:
-- insert into public.pos_licenses (license_key, app_code, locked, firm_name)
-- values ('TEST-MARINA-0001', 'marina-pos', false, 'Test musteri');
