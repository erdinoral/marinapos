# Marina Nargile POS — Sürüm 1.8.0

**Tarih:** 4 Haziran 2026  
**Kurulum:** `Marina-Nargile-POS-1.8.0-Setup.exe`  
**GitHub tag:** `v1.8.0`  
**Repo:** `erdinoral/marinapos`

---

## GitHub Release başlığı (kopyala)

```
Marina Nargile POS 1.8.0
```

---

## GitHub Release açıklaması (kopyala)

Aşağıdaki blok `RELEASE_CHANGELOG_MD` ile aynıdır; GitHub Release → **Describe this release** alanına yapıştırın.

```markdown
## Marina Nargile POS 1.8.0

Kurulu uygulamalar **Ayarlar → Güncelleme** üzerinden bu sürümü indirebilir. Verileriniz (satış, stok, müşteri, ayarlar) korunur; yine de yayın öncesi yedek almanız önerilir.

### Yeni özellikler

#### Müşteri, kafe ve fatura
- Geçmiş satışlardan **fatura oluşturma** (önizleme, kaydet, yazdır)
- Müşteri/kafe kartında son alış satırı için **Fatura** düğmesi
- Son işlemler listesinde fatura (200 kayıt)

#### Tedarikçi ve stok girişi
- **Gelen / stok ekle:** tedarikçi seçince o firmaya bağlı ürün listesi, sepet, tek fatura grubu (SRB)
- Sepette **+5 / +10** hızlı adet; **Sepete ekle** ürün detayının sağ altında
- Tedarikçi geçmişinde stok girişleri gruplanır; **fatura tutarı** veya ürün geliş fiyatından hesaplanan tutar görünür
- Ürün/stok girişinde **kısmi borç**; tedarikçi borç ödemesi (nakit/kart, not)
- Tedarikçi detay: stok listesindeki gibi **maliyet / tahmini ciro / brüt kâr** özeti

#### Müşteri borç
- Müşteri borç **tahsilat** paneli (nakit/kart, not)

#### POS ve stok görünümü
- Tüm ürün kartlarında **stok etiketi:** yeşil (yeterli), sarı (≤10 adet), kırmızı (stok yok)
- Sepet satırında **+5 / +10** ile adet artırma; Birim TL ve İnd. % alanları kompakt

#### Diğer
- **Düzenlenebilir uygulama başlığı** (Ayarlar)
- **Tütün içerikleri** ekranı: aroma kartları, üzerine gelince içerik; düzenleme modalı
- **Ürün ekle** artık gidere yazmaz; gider yalnızca **Stok → Stok ekle** ile

### İyileştirmeler
- Stok listesi kaydırma, ~15 satır görünüm, eşit sütunlar
- Klavye odak sorunu (Windows/Electron) azaltıldı
- Ayarlar: sürümler ve geri bildirim butonları tema ile uyumlu
- Tütün ekranında hover içerik kutusu kesilmez; gereksiz arka panel kaldırıldı

### Güncelleme
- GitHub Release üzerinden otomatik sürüm kontrolü (`electron-updater`)

### Teknik notlar
- Kurulum boyutu optimizasyonları (önceki sürümlerle birlikte)
- Lisans ve geri bildirim Supabase entegrasyonu (yapılandırmaya bağlı)
```

---

## Uygulama içi sürüm notları

**Hesap → Sürümler** ekranında `accountReleaseNotes.ts` içindeki `APP_RELEASE_NOTES` listelenir. Başlıklar:

| Başlık | Özet |
|--------|------|
| Müşteri / Kafe ve fatura | Geçmiş satış faturası, son alış ve son işlemler |
| Tedarikçi stok ve fatura | Gelen stok sepeti, SRB grupları, geçmiş tutarları |
| Cari ve borç | Tedarikçi/müşteri borç, ödeme ve tahsilat |
| POS stok etiketi | Yeşil / sarı / kırmızı miktar rozeti tüm ürünlerde |
| Sepet hızlı adet | +5 ve +10 (stok ekle ve POS sepeti) |
| Stok ve arayüz | Liste, başlık, tütün kartları, klavye odak |
| Gider kaydı | Ürün ekle ≠ gider; stok ekle = gider |
| Güncelleme | Otomatik sürüm kontrolü, veri korunur |

---

## Senin yapman gerekenler (kontrol listesi)

### 1) Yerel test

```powershell
cd "F:\Site_ve_Uygulamalar\UYGULAMALAR\Marina Nargile orj"
npm run build
npm run pack
```

Çıktı: `release\Marina-Nargile-POS-1.8.0-Setup.exe` — kurup POS, stok, tedarikçi, tütün, güncelleme ekranını dene.

### 2) Git commit (istersen)

Değişiklikleri commit etmeden tag atma. Örnek:

```powershell
git add -A
git commit -m "chore: release 1.8.0 — fatura, tedarikçi sepet, POS stok etiketi, UI"
```

### 3) GitHub’a yayın

**A) Komut satırı (token gerekir)**

```powershell
$env:GH_TOKEN = "<github_pat>"
git tag v1.8.0
git push origin main
git push origin v1.8.0
npm run publish:win
```

**B) Manuel**

1. `npm run pack` ile `release\` klasöründeki Setup + `latest.yml` + `.blockmap` dosyalarını al
2. GitHub → **Releases** → **Draft a new release**
3. Tag: `v1.8.0`, başlık ve açıklama: yukarıdaki markdown
4. Dosyaları ekle → **Publish release**

### 4) Müşteri tarafı

1. Kurulu uygulama: **Ayarlar → Güncelleme → Güncellemeleri kontrol et**
2. İndir → **Yeniden başlat ve kur**
3. Veri: `%APPDATA%\marina-nargile-pos\` altında kalır (yedek yine önerilir)

---

## İmza (SmartScreen)

Kod imzası için: `docs/RELEASE-SIGNING.md`

---

## Sorun

| Belirti | Ne yap |
|---------|--------|
| Güncelleme görünmüyor | `v1.8.0` tag ve `latest.yml` release’de mi |
| publish hata | `GH_TOKEN` repo yetkisi; tag `v1.8.0` formatı |
| Eski sürüm notları | `accountReleaseNotes.ts` → `APP_VERSION` = 1.8.0 |
