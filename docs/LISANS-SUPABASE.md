# Supabase lisans (ozet)

Detayli sablon: **`docs/LISANS-TEMEL.md`**

## Tablolar

| Tablo | Is |
|--------|-----|
| `pos_licenses` | Tum lisans anahtarlari (`app_code` ile uygulama ayiri) |
| `pos_license_config` | Tumunu kapatma, offline gun sayisi |

## Ornek satir

```
license_key:  MARINA-2026-XXXX
app_code:     marina-pos
locked:       false
firm_name:    Marina Nargile
device_id:    (bos)
```

## Baglanti (gelistirme)

`.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## Baglanti (musteri kurulumu)

`build/supabase-license.json` — ornek: `build/supabase-license.example.json`

JSON URL yedegi: `docs/LISANS-UZAKTAN.md`
