-- Gecis scripti: once tablolari olusturur, sonra eski isimlerden tasir.
-- Hata: "pos_licenses does not exist" aldiysaniz bu dosyayi tekrar Run edin.

-- 1) Temel tablolar (yoksa olustur)
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

create table if not exists public.pos_licenses (
  license_key text primary key,
  app_code text not null default 'marina-pos',
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

-- 2) Eski pos_license_keys varsa veriyi tasi
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'pos_license_keys'
  ) then
    insert into public.pos_licenses (
      license_key, app_code, device_id, locked, message, valid_until, firm_name, note, created_at, updated_at
    )
    select
      license_key,
      'marina-pos',
      device_id,
      coalesce(locked, false),
      message,
      valid_until,
      firm_name,
      note,
      coalesce(created_at, now()),
      coalesce(updated_at, now())
    from public.pos_license_keys
    on conflict (license_key) do nothing;
  end if;
end $$;

-- 3) RLS
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

-- Eski tablolar (istege bagli, veri tasidiktan sonra):
-- drop table if exists public.pos_license_keys;
-- drop table if exists public.pos_device_licenses;
