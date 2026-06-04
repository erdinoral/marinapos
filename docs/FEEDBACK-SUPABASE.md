# Geri bildirim (Soru / Gorus / Oneri)

POS uygulamasindaki **Ayarlar → Soru, gorus, oneri** formu Akiyom Supabase projenize kayit atar. Gonderilen mesajlar **Gonderdiginiz mesajlar** altinda durum etiketi ile listelenir.

## Kurulum (bir kez)

1. Supabase Dashboard → **SQL Editor**
2. Ilk kurulum: `supabase/feedback-tables.sql` (8 parametreli `submit_app_feedback`, `account_email` dahil)
3. Tablo zaten varsa yanit alanlari icin: `supabase/feedback-replies-migration.sql`
4. **Gonderim RLS hatasi** alirsaniz: `supabase/feedback-rls-fix.sql` (bir kez; RPC ve `account_email` gunceller)
5. **Durum etiketleri** icin: `supabase/feedback-status-migration.sql` (bir kez)
6. Eski kurulumda sadece 7 parametreli RPC varsa: `feedback-rls-fix.sql` veya `feedback-account-migration.sql` calistirin
7. Lisans icin kullandiginiz `.env.local` / `build/supabase-license.json` ayarlari ayni kalir
8. **Kurulum (.exe)**: `npm run pack` oncesi gercek `build/supabase-license.json` olmali (gitignore; ornek dosya yeterli degil)

## Tablo: `app_feedback`

| Alan | Aciklama |
|------|----------|
| `title` | Baslik |
| `body` | Sorun / aciklama |
| `contact_name` | Gonderen adi |
| `company_name` | Firma unvani (ayarlardan) |
| `image_path` | Storage yolu (varsa) |
| `admin_reply` | Panelden yazilan yanit (varsa gosterilir) |
| `replied_at` | Yanit tarihi |
| `status` | `new` / `read` / `in_progress` / `answered` / `closed` — panel ile ayni etiketler |

Gorseller: bucket `feedback-images`, yol `{app_code}/{uuid}-dosya.jpg`

## Panelden durum / yanit

Durum guncelleme (uygulamada etiket olarak gorunur):

```sql
update app_feedback
set status = 'in_progress'
where id = 'GERCEK-UUID-BURAYA';
```

Yanit ile birlikte:

```sql
update app_feedback
set
  admin_reply = 'Merhaba, sorununuz giderildi. Surumu yeniden baslatin.',
  replied_at = now(),
  status = 'answered'
where id = 'GERCEK-UUID-BURAYA';
```

Kapatmak icin:

```sql
update app_feedback
set status = 'closed'
where id = 'GERCEK-UUID-BURAYA';
```

| status (Supabase) | Panel / uygulama etiketi |
|-------------------|--------------------------|
| `new` | Yeni |
| `read` | Okundu |
| `in_progress` | Yapim asamasinda |
| `answered` | Yanitlandi |
| `closed` | Kapandi |

Mesajlar **Ayarlar → Soru, gorus, oneri → Gonderdiginiz mesajlar** altinda listelenir; basligin yaninda durum etiketi gorunur.

Uygulama, **Ayarlar → Firma Unvani** ile eslesen `company_name` kayitlarini listeler (`get_app_feedback_replies` RPC).

## akiyom.com'da listeleme

Admin tarafinda **service role key** kullanin (anon ile dogrudan SELECT kapali).

Ornek sorgu:

```sql
select id, created_at, app_code, app_version, title, body, contact_name, company_name, image_path, admin_reply, replied_at, status
from app_feedback
order by created_at desc;
```

Gorsel indirmek icin Supabase Storage API veya signed URL (service role).

Next.js ornegi (server action / route handler):

```typescript
const { data } = await supabaseAdmin.storage.from("feedback-images").createSignedUrl(image_path, 3600);
```

## Guvenlik

- Anon key sadece **INSERT** ve yanit okuma RPC'si (`get_app_feedback_replies`) calistirabilir
- RPC yalnizca `admin_reply` dolu ve firma adi eslesen kayitlari dondurur
- Okuma / duzenleme / silme yalnizca akiyom.com backend (service role veya authenticated admin)

## Sorun giderme (musteri gonderdi, Supabase'de yok)

1. **Supabase SQL** — Tum kayitlar (firma filtresi yok):

```sql
select id, created_at, app_code, title, contact_name, company_name, account_email, status
from app_feedback
order by created_at desc
limit 50;
```

2. **Kurulumda Supabase yok** — Ayarlarda form yerine mailto metni gorunur; gonderim Supabase'e gitmez. Lisans calisiyorsa genelde JSON vardir.

3. **RPC uyumsuzlugu** — Uygulama `p_account_email` gonderir; DB'de 7 parametreli eski fonksiyon varsa gonderim basarisiz olur. Yeni surumde otomatik 7 parametreye duser; yine de `feedback-rls-fix.sql` calistirin.

4. **Gorsel** — Storage bucket/policy eksikse yeni surum metni yine kaydeder (gorsel atlanir). Eski surumde tum gonderim iptal olabilirdi.

5. **Musteri PC logu** — Ayarlar → Hata Loglari: `[feedback:submit] OK` veya hata satiri (1.7.1+).

6. **Panel listesi** — `get_app_feedback_replies` sadece **Ayarlar → Firma Unvani** ile birebir eslesen `company_name` kayitlarini gosterir; admin SQL tum satirlari gosterir.
