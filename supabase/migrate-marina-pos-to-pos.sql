-- Daha once marina_pos_* tablolarini olusturduysaniz bir kez calistirin.
-- Hic marina_pos_* yoksa license-tables.sql yeterli; bunu atlayin.

alter table if exists public.marina_pos_license_config rename to pos_license_config;
alter table if exists public.marina_pos_device_licenses rename to pos_device_licenses;

-- Eski policy isimleri (varsa)
drop policy if exists "marina_pos_anon_read_config" on public.pos_license_config;
drop policy if exists "marina_pos_anon_read_devices" on public.pos_device_licenses;

drop policy if exists "pos_anon_read_config" on public.pos_license_config;
create policy "pos_anon_read_config"
  on public.pos_license_config for select to anon using (true);

drop policy if exists "pos_anon_read_devices" on public.pos_device_licenses;
create policy "pos_anon_read_devices"
  on public.pos_device_licenses for select to anon using (true);

alter table public.pos_device_licenses add column if not exists firm_name text;
