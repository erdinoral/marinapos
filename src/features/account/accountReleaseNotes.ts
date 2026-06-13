export const APP_VERSION = "1.8.8";
export const APP_RELEASE_DATE = "13 Haziran 2026";

/** Hesap → Surumler ekraninda kartlar */
export const APP_RELEASE_NOTES: { title: string; body: string }[] = [
  {
    title: "Lisans / guncelleme duzeltmesi",
    body:
      "Otomatik guncelleme sonrasi lisans sunucusu bulunamama hatasi giderildi. CI build'e Supabase yapilandirmasi dahil edilir."
  },
  {
    title: "Stok fatura gruplama (1.8.7)",
    body:
      "Toplu fatura kalemleri gecmiste tek satirda; ⋯ menusu ile gor, duzelt, sil."
  },
  {
    title: "Fatura duzenleme (1.8.7)",
    body:
      "Faturayi duzelt modunda kaleme tiklayarak adet ve birim fiyat guncellenir."
  },
  {
    title: "Stok girisi silme (1.8.7)",
    body:
      "Yalnizca en son giris silinebilir; SRB toplu faturada tum fatura silinir."
  },
  {
    title: "Eksi stok (1.8.6)",
    body:
      "Stoksuz satis sonrasi eksi bakiye korunur; stok girisinde once eksik kapanir."
  }
];

/** GitHub Release / electron-updater changelog */
export const RELEASE_CHANGELOG_MD = `## Marina Nargile POS 1.8.8

Kurulu uygulamalar **Ayarlar → Guncelleme** uzerinden bu surumu indirebilir. Verileriniz korunur; yine de yayin oncesi yedek almaniz onerilir.

### Duzeltme

#### Lisans / otomatik guncelleme
- GitHub Actions ile uretilen kurulum dosyasina **Supabase lisans yapilandirmasi** artik dahil edilir
- Guncelleme sonrasi **"Yapilandirma eksik"** hatasi giderildi
- Son gecerli lisans oturumu varsa gecici olarak acilisa izin verilir (7 gun)

### Onceki surumden (1.8.7 ozeti)
- Stok fatura gruplama, ⋯ menusu, fatura duzenleme ve silme
`;
