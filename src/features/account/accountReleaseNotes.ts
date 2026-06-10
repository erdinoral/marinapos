export const APP_VERSION = "1.8.4";
export const APP_RELEASE_DATE = "11 Haziran 2026";

/** Hesap → Surumler ekraninda kartlar */
export const APP_RELEASE_NOTES: { title: string; body: string }[] = [
  {
    title: "Coklu tedarikci",
    body:
      "Urun kartinda birincil tedarikci + ek tedarikci (+). Toplu faturada urun bagli tum firmalarda listelenir; tekli stok girisinde yalnizca karttaki tedarikciler secilir."
  },
  {
    title: "AI Asistan paneli",
    body:
      "Sag kenarda burger menusu ve AI Asistan etiketi; tiklayinca yan panel acilir. Sohbet tum ekranlarda erisilebilir."
  },
  {
    title: "Stok listesi ozeti",
    body:
      "Stok listesinde maliyet / ciro ozeti altta sabit kalir; yalnizca urun listesi kayar."
  },
  {
    title: "Urun duzenle arayuzu",
    body:
      "Urun duzenle penceresindeki acilir listeler ve butonlar koyu temaya uyumlu hale getirildi."
  },
  {
    title: "Satis gecmisi (1.8.3)",
    body:
      "Stok → Gecmis ve analiz → Satis gecmisi; filtreler, detay, fatura ve iade icin sepete alma."
  },
  {
    title: "Moduler yedekleme (1.8.3)",
    body:
      "Yedekleme ve geri yuklemede bolum secimi. Eski tam JSON yedekleri desteklenir."
  },
  {
    title: "POS toptan (1.8.2)",
    body:
      "Sepette urun varken Toptan secilince satirlar toptan fiyata gecer."
  }
];

/** GitHub Release / electron-updater changelog */
export const RELEASE_CHANGELOG_MD = `## Marina Nargile POS 1.8.4

Kurulu uygulamalar **Ayarlar → Guncelleme** uzerinden bu surumu indirebilir. Verileriniz korunur; yine de yayin oncesi yedek almaniz onerilir.

### Yeni

#### Coklu tedarikci
- Urun karti: **birincil tedarikci** + **+** ile **ek tedarikci** (Tedarikci 2, 3…)
- **Toplu fatura:** secilen firmaya bagli urunler listelenir; ayni urun birden fazla tedarikcide tanimliysa her firmada gorunur
- **Gelen / stok ekle (tekli):** tedarikci listesi yalnizca urun kartindaki firmalardan gelir; stok secilen tedarikciye yazilir
- Stok listesinde tedarikci: \`Firma A (+1)\` gibi gosterim

#### AI Asistan
- Sag kenar **burger menusu** ve dikey **AI Asistan** etiketi
- Tiklayinca sagdan acilan **yan panel**; arka plana tiklayarak veya X ile kapanir

#### Stok listesi
- Alt ozet (maliyet, tahmini ciro, kar) **sabit**; yalnizca urun listesi kayar

#### Urun duzenle
- Kategori / tedarikci acilir listeleri ve Kapat / Vazgec butonlari koyu temaya uyumlu

### Onceki surumden (1.8.3 ozeti)
- Satis gecmisi, iade akisi, stok girisi silme, moduler yedekleme
- POS toptan fiyat, stok ekrani sekmeleri, guncelleme ekrani iyilestirmeleri
`;
