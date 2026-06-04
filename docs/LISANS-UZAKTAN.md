# Uzaktan lisans kilidi (musteri odemesi)

Marina POS, internet uzerinden lisans durumunu okur. Odeme yapilmayan musterinin cihazini uzaktan kilitleyebilirsiniz.

**Supabase (onerilen):** Table Editor’dan kilitleme — `docs/LISANS-SUPABASE.md`

**JSON dosyasi:** Asagidaki adimlar (GitHub raw vb.)

## 1. Lisans dosyasini yayinlayin

`license-registry.example.json` dosyasini kopyalayip duzenleyin. Ornek barindirma:

- GitHub repo icinde `license-registry.json` + **Raw** link
- Google Drive / Dropbox **dogrudan indirme** linki (JSON donmeli)
- Kendi sunucunuz (HTTPS)

Dosyayi her degistirdiginizde musteri programi en gec **30 dakika** icinde (veya yeniden acinca) guncel durumu alir.

## 2. Kurulumda URL verin

Musteriye gondermeden once `build/license-registry.url` dosyasi olusturun (tek satir, ornek: `build/license-registry.url.example`):

```text
https://raw.githubusercontent.com/SIZIN/hesap/main/license-registry.json
```

Alternatif: paketlemeden once ortam degiskeni:

```text
set MARINA_LICENSE_URL=https://.../license-registry.json
npm run pack
```

Bu dosya kurulumla birlikte `build/` altinda gider (`electron-builder` `build/icons` ile ayni klasor).

## 3. Musteri cihazini aktif edin

1. Programi musteride bir kez acin.
2. Kilit ekraninda **cihaz kodu** gorunur (orn. `MARINA-A1B2C3D4`).
3. JSON icinde `devices` altina ekleyin:

```json
"MARINA-A1B2C3D4": {
  "locked": false,
  "validUntil": "2026-12-31"
}
```

4. Dosyayi kaydedip yayinlayin; musteri **Tekrar kontrol et** veya bir sure sonra acilir.

## 4. Odemeyi geciktiren musteriyi kilitleyin

```json
"MARINA-A1B2C3D4": {
  "locked": true,
  "message": "Odeme gecikmesi. 05xx xxx xx xx"
}
```

Tum kurulumlari birden kapatmak icin:

```json
"globalLock": true,
"globalMessage": "Bakim / sozlesme guncellemesi"
```

## 5. Gelistirme (sizin bilgisayar)

- URL yoksa veya `MARINA_SKIP_LICENSE=1` ise kilit **devre disi** (yerel gelistirme).
- Test icin `build/license-registry.url` + gercek JSON kullanin.

## Alanlar

| Alan | Aciklama |
|------|----------|
| `offlineGraceDays` | Internet yokken kac gun son aktif kalinir (varsayilan 7) |
| `devices[id].locked` | `true` = POS kapali |
| `devices[id].validUntil` | `YYYY-MM-DD` sonrasi otomatik kilit |
| `devices[id].message` | Kilit ekranindaki metin |

Liste disindaki cihaz kodlari **aktivasyon bekliyor** durumunda kalir.
