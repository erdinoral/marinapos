# Lisans temeli (tum uygulamalar)

En kolay model: **tek Supabase tablosu**, siz sadece satir eklersiniz; her uygulama kendi `app_code` ile kontrol eder.

## Supabase (bir kez)

1. SQL Editor → `supabase/license-tables.sql` → **Run**
2. Eski tablolar varsa → `supabase/migrate-to-pos-licenses.sql` → **Run**

## Sizin panel: `pos_licenses`

| Sutun | Ornek |
|--------|--------|
| `license_key` | `MARINA-2026-AB12CD` |
| `app_code` | `marina-pos` |
| `locked` | `false` = acik, `true` = uzaktan kapat |
| `firm_name` | Musteri / firma adi |
| `valid_until` | `2026-12-31` (istege bagli) |
| `device_id` | Bos birakin; ilk kurulumda PC yazar |

Tum uygulamalar **ayni tabloya** bakar; `app_code` karistirmaz.

## Bu proje (Marina POS)

- Kod: `src/config/licenseApp.ts` → `LICENSE_APP_CODE = "marina-pos"`
- Baglanti: `.env.local` veya `build/supabase-license.json`
- Akis: anahtar bir kez girilir → `data/marina-pos.json` icinde kalir → her acilista Supabase kontrolu

## Yeni uygulama eklerken (5 adim)

1. Supabase'de `pos_licenses` satiri: yeni `app_code` (orn. `cafe-pos`) + yeni `license_key`
2. Yeni projede `LICENSE_APP_CODE = "cafe-pos"`
3. Ayni `.env.local` URL + anon (Akiyom projesi)
4. Lisans modulunu kopyala: `licenseService`, `licenseSupabase`, `licenseApp`, `LicenseLockScreen`, electron `licenseRuntime`
5. `npm run pack` oncesi `build/supabase-license.json` (url, anonKey, appCode)

JSON dosya lisansi (`license-registry.url`) istege bagli yedek; **ana yol Supabase.**

## Global kapatma

`pos_license_config` → `global_lock = true` → tum uygulamalar (internet varken) kapanir.
