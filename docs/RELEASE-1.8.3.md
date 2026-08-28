# Marina Nargile POS — Sürüm 1.8.3

**Tarih:** 10 Haziran 2026  
**Kurulum:** `Marina-Nargile-POS-1.8.3-Setup.exe`  
**GitHub tag:** `1.8.3` (veya `v1.8.3`)  
**Repo:** `erdinoral/marinapos`

---

## GitHub Release başlığı (kopyala)

```
Marina Nargile POS 1.8.3
```

---

## GitHub Release açıklaması (kopyala)

```markdown
## Marina Nargile POS 1.8.3

Kurulu uygulamalar **Ayarlar → Güncelleme** üzerinden bu sürümü indirebilir. Verileriniz korunur; yine de yayın öncesi yedek almanız önerilir.

### Yeni

#### Satış geçmişi
- **Stok → Geçmiş ve analiz → Satış geçmişi:** tüm işlemler (satış, iade, borç ödemesi, Sepet 1/2)
- Filtreler: işlem türü, ödeme, müşteri, birim, kategori, arama, sıralama
- Satıra tıklayınca **detay penceresi:** sepet satırları, tahsilat, borç bilgisi
- Detaydan **Fatura oluştur** veya **İade için sepete al** (POS satış sekmesine geçer)

#### İade akışı
- Satış geçmişinden seçilen satış, POS sepetine otomatik yüklenir; işlem türü **İade** olur
- Orijinal birim fiyatlar korunur; eksik/silinen ürünler için uyarı

#### Stok
- **Stok ekleme geçmişi:** yanlış girişi **Sil** (stok, FIFO, gider ve tedarikçi borcu geri alınır)
- Yalnızca ürünün **en son** girişi silinebilir
- Toplu fatura: kalan borç satırlara dağıtım, liste maliyeti gösterimi

#### Yedekleme
- **Modüler yedek:** yedekleme ve geri yüklemede bölüm seçimi (katalog, müşteri, satış, stok, kapanış, gelir/gider, ayarlar)
- Eski tam JSON yedekleri geri yüklenmeye devam eder

#### POS toptan (1.8.2)
- Sepette ürün varken **Toptan** seçilince fiyatlar anında toptan birim fiyatına geçer
- **Perakende**'ye dönünce liste fiyatları geri uygulanır
- Ürün formunda **Toptan satışa açık** ve toptan fiyat alanı

#### Stok ekranı sekmeler (1.8.2)
- Üst sekmeler: **Stok yönetimi** ve **Geçmiş ve analiz**
- Stok yönetimi: Stok Listesi, Eksik liste
- Geçmiş ve analiz: Stokta kalma / satış süresi, Stok ekleme geçmişi, Satış geçmişi
- Listeden ürün seçilince otomatik **Stok Ekle** akışı

#### Güncelleme (1.8.2)
- GitHub **504 / zaman aşımı** hatalarında okunabilir Türkçe mesaj
- Geçici hatalarda otomatik yeniden deneme
- Hata durumunda **Sürümler sayfası**ndan elle kurulum ipucu

### Önceki sürümden (1.8.0 özeti)
- POS gram: ondalıklı gram, sabit tutar alanı
- Toplu fatura: Liste, fatura toplamı özeti
- Uygulama başlığı yalnızca üst menüde; footer **Marina Nargile**
```

---

## Senin yapman gerekenler

### 1) Yerel test

```powershell
cd "F:\Site_ve_Uygulamalar\UYGULAMALAR\Marina Nargile orj"
npm run build
npm run pack
```

Çıktı: `release\Marina-Nargile-POS-1.8.3-Setup.exe`

### 2) Git commit + tag

```powershell
git add -A
git commit -m "chore: release 1.8.3"
git tag 1.8.3
git push origin main
git push origin 1.8.3
```

### 3) GitHub Release

**Seçenek A — otomatik (GH_TOKEN gerekir):**

```powershell
$env:GH_TOKEN = "<github_pat veya gh auth token>"
npm run publish:win
```

**Seçenek B — manuel:**

1. `release\` klasöründen şunları yükle:
   - `Marina-Nargile-POS-1.8.3-Setup.exe`
   - `latest.yml`
   - `Marina-Nargile-POS-1.8.3-Setup.exe.blockmap`
2. Tag: `1.8.3`
3. Başlık ve açıklama: yukarıdaki markdown
4. **Publish release**

### 4) Müşteri tarafı

**Ayarlar → Güncelleme → Güncellemeleri kontrol et** veya Setup ile kur.

---

## Sorun

| Belirti | Ne yap |
|---------|--------|
| Güncelleme görünmüyor | `latest.yml` ve Setup release'de mi |
| 504 hatası | Birkaç dk sonra tekrar dene veya Sürümler sayfasından indir |
| İade sepete gelmiyor | Orijinal satış mı; ürün silinmiş mi kontrol et |
| Stok girişi silinmiyor | Daha yeni giriş var mı; stok yeterli mi |
