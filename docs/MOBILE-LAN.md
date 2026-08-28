# Marina POS — Mobil (yerel ağ) API

Android uygulaması, kasadaki PC'de çalışan Marina Nargile POS ile **aynı Wi‑Fi** üzerinden konuşur. **Tüm veri PC'deki `marina-pos.json` ve `data/media/` klasörüne yazılır** — telefon yalnızca arayüzdür.

## Bağlantı akışı

1. PC'de **Ayarlar → Mobil uygulama (yerel ağ) → Aç** (veya üst bardaki telefon ikonu)
2. **APK indir QR** — telefon kamerası ile okut → APK PC'den iner, kurulur
3. **Bağlantı QR** — Marina POS Mobil uygulaması içinden okut
4. Uygulama QR içindeki JSON'u parse eder, `host`, `port`, `token` saklar
5. Sonraki isteklerde header: `Authorization: Bearer <token>`

## Endpoint'ler

Tüm yanıtlar JSON. Başarı: `{ "ok": true, "data": … }` — Hata: `{ "ok": false, "error": "…" }`

### Genel

| Method | Path | Auth | Açıklama |
|--------|------|------|----------|
| GET | `/api/health` | Hayır | Sunucu ayakta mı |
| GET | `/api/mobile/apk/info` | Hayır | APK meta (boyut, URL) |
| GET | `/api/mobile/install` | Hayır | İndirme sayfası (HTML, otomatik APK) |
| GET | `/api/mobile/apk` | Hayır | APK dosyası indir |
| GET | `/api/pair/info` | Evet | Bağlantı bilgisi |
| GET | `/api/settings` | Evet | Ayarlar |

APK dosya konumları (PC): `%APPDATA%/Marina Nargile POS/data/mobile/marina-pos-mobile.apk` (kurulu uygulama; Setup APK içermez). Geliştirmede ayrıca `build/mobile/`.

### Katalog

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/api/products` | Aktif ürün listesi |
| GET | `/api/products/{id}` | Tek ürün |
| GET | `/api/products/barcode/{code}` | Barkod ile ürün |
| POST | `/api/products` | Yeni ürün |
| PUT | `/api/products/{id}` | Ürün güncelle |
| DELETE | `/api/products/{id}` | Ürün sil (soft) |
| GET | `/api/categories` | Kategoriler |
| POST | `/api/categories` | Yeni kategori |
| PUT | `/api/categories/{id}` | Kategori güncelle |
| DELETE | `/api/categories/{id}` | Kategori sil (aktif ürün olmamalı) |
| GET | `/api/suppliers` | Tedarikçiler |

### Medya (PC'de saklanır)

| Method | Path | Açıklama |
|--------|------|----------|
| POST | `/api/media/upload` | Base64 resim yükle → `imagePath` döner |
| GET | `/api/media/data-url?path=…` | PC'deki resmi data URL olarak oku |

`POST /api/media/upload` gövdesi:

```json
{
  "suggestedName": "urun-adi",
  "mimeType": "image/jpeg",
  "dataBase64": "…"
}
```

### Stok

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/api/stock/low` | Düşük stok listesi |
| POST | `/api/stock/add` | Stok girişi |
| POST | `/api/stock/adjust` | Sayım / düzeltme |

### Satış

| Method | Path | Açıklama |
|--------|------|----------|
| POST | `/api/sales` | Satış / iade / borç tahsilatı |
| GET | `/api/sales/today?date=YYYY-MM-DD` | Günlük satış listesi |
| GET | `/api/sales/history?limit=50` | Satış geçmişi |

### Müşteri

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/api/customers` | Müşteri listesi |
| POST | `/api/customers` | Yeni müşteri |
| PUT | `/api/customers/{id}` | Müşteri güncelle |

### Rapor & kapanış

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/api/reports/dashboard` | Genel özet |
| GET | `/api/reports/day-profit?date=…` | Günlük kar |
| GET | `/api/reports/monthly-days?month=YYYY-MM` | Aylık tablo |
| POST | `/api/closure/run` | Gün sonu kapanışı |

### Gelir / gider

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/api/cashflow?month=YYYY-MM` | Ay kayıtları + özet |
| POST | `/api/cashflow` | Yeni kayıt |
| DELETE | `/api/cashflow/{id}` | Kayıt sil |

### Tütün

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/api/tobacco` | Aroma kartları |
| POST | `/api/tobacco` | Yeni kart |
| PUT | `/api/tobacco/{id}` | Güncelle |
| DELETE | `/api/tobacco/{id}` | Sil |

### Paylaşımlı kasa sepeti (PC ↔ mobil)

Mobil ekleme PC'deki **aktif sepete** kuyruğa alınır; PC kasa ekranı ~1 sn içinde uygular. PC'deki sepet mobilde görüntülenir (miktar düzenleme PC'den).

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/api/pos/cart` | Güncel sepet (`revision`, `lines`, ürün özeti) |
| POST | `/api/pos/cart/scan` | Barkod okut → sepete ekle kuyruğu (`{ barcode }`) |
| POST | `/api/pos/cart/add` | Ürün ID ile ekle (`{ productId, qty? }`) |
| POST | `/api/pos/cart/clear` | Paylaşımlı sepeti temizle (satış sonrası) |

Mobil **el terminali** modu: sürekli barkod okuma → `POST /api/pos/cart/scan`.

## Mobil uygulama sekmeleri

`mobile/` — Expo React Native v2:

| Sekme | Özellik |
|-------|---------|
| Satış | Sepet, barkod, müşteri, nakit/kart — PC'ye anında yazılır |
| Stok | Stok ekle, sayım, düşük stok uyarısı |
| Ürün | Ekle/düzenle, galeri/kamera ile resim (PC `media/` klasörü) |
| Müşteri | Liste, yeni müşteri |
| Rapor | Özet, bugün, kapanış, gider, aylık tablo |
| Tütün | Aroma kartları CRUD |
| Ayarlar | Bağlantı testi |

## Güvenlik

- Sunucu yalnızca yerel ağda dinler
- Token QR ile paylaşılır — dükkân içi kullanım
- **Yeni QR** eski telefon bağlantılarını keser
- PC uygulamasını güncelledikten sonra mobil sunucuyu yeniden başlatın (PC'yi kapat/aç)
