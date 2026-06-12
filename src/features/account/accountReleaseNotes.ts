export const APP_VERSION = "1.8.6";
export const APP_RELEASE_DATE = "11 Haziran 2026";

/** Hesap → Surumler ekraninda kartlar */
export const APP_RELEASE_NOTES: { title: string; body: string }[] = [
  {
    title: "Eksi stok duzeltmesi",
    body:
      "Stoksuz satis sonrasi eksi bakiye korunur; stok girisinde once eksik kapanir, FIFO dogru yazilir."
  },
  {
    title: "Eksik liste tedarikci filtresi",
    body:
      "Eksik listede firmaya gore filtre; birincil ve ek tedarikci bagli urunler listelenir."
  },
  {
    title: "Sepet +5 / +10",
    body:
      "Adet 1 iken +5 -> 5, +10 -> 10; diger adetlerde uzerine eklenir (ornek 3 +10 = 13)."
  },
  {
    title: "Toplu fatura (1.8.5)",
    body:
      "Yarim kalan liste taslak, odenen tutar, liste Sil butonu, urunu sil."
  },
  {
    title: "Coklu tedarikci (1.8.4)",
    body:
      "Birincil + ek tedarikci; toplu fatura ve stok girisi karttaki firmalara gore calisir."
  },
  {
    title: "AI Asistan (1.8.4)",
    body:
      "Sag kenar burger menusu ve yan panel; tum ekranlarda erisilebilir."
  }
];

/** GitHub Release / electron-updater changelog */
export const RELEASE_CHANGELOG_MD = `## Marina Nargile POS 1.8.6

Kurulu uygulamalar **Ayarlar → Guncelleme** uzerinden bu surumu indirebilir. Verileriniz korunur; yine de yayin oncesi yedek almaniz onerilir.

### Yeni

#### Eksi stok
- Stoksuz satista **eksi stok** kaydedilir ve uygulama yeniden acilinca korunur
- Stok girisinde gelen miktar once **eksik satis borcunu** kapatir; yalnizca kalan miktar FIFO'ya yazilir
- Stok girisi modalinda eksi stok uyarisi

#### Eksik liste
- **Tedarikci filtresi** (birincil + ek tedarikci dahil)
- Yazdirma secili filtreyi kullanir

#### Sepet
- **+5 / +10** adet butonlari: 1 iken dogrudan 5 veya 10; diger adetlerde uzerine ekler

### Onceki surumden (1.8.5 ozeti)
- Toplu fatura taslak, odenen tutar, urunu sil
- Coklu tedarikci, AI Asistan, satis gecmisi
`;
