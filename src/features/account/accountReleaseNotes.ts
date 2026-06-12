export const APP_VERSION = "1.8.7";
export const APP_RELEASE_DATE = "10 Haziran 2026";

/** Hesap → Surumler ekraninda kartlar */
export const APP_RELEASE_NOTES: { title: string; body: string }[] = [
  {
    title: "Stok fatura gruplama",
    body:
      "Toplu fatura kalemleri gecmiste tek satirda; tiklayinca detay tablosu acilir. Ayni saniyedeki eski kayitlar da gruplanir."
  },
  {
    title: "Fatura islem menusu",
    body:
      "Stok gecmisinde ⋯ ve sag tik: Faturayi gor, duzelt, sil. Satira tiklamak yalnizca detay acar; duzenleme menuden."
  },
  {
    title: "Fatura duzenleme",
    body:
      "Faturayi duzelt modunda kaleme tiklayarak adet ve birim fiyat guncellenir; toplu fatura tamami silinebilir."
  },
  {
    title: "Stok girisi silme",
    body:
      "Yalnizca en son giris silinebilir; SRB toplu faturada tek satirdan tum fatura silinir. Iade ve borc odemeleri karismaz."
  },
  {
    title: "Eksi stok (1.8.6)",
    body:
      "Stoksuz satis sonrasi eksi bakiye korunur; stok girisinde once eksik kapanir, FIFO dogru yazilir."
  },
  {
    title: "Toplu fatura (1.8.5)",
    body:
      "Yarim kalan liste taslak, odenen tutar, liste Sil butonu, urunu sil."
  }
];

/** GitHub Release / electron-updater changelog */
export const RELEASE_CHANGELOG_MD = `## Marina Nargile POS 1.8.7

Kurulu uygulamalar **Ayarlar → Guncelleme** uzerinden bu surumu indirebilir. Verileriniz korunur; yine de yayin oncesi yedek almaniz onerilir.

### Yeni

#### Stok ekleme gecmisi
- **Toplu fatura** kalemleri tek satirda gruplanir; tiklayinca kalem detayi acilir
- Eski kayitlar (SRB olmadan ayni saniye + tedarikci) otomatik gruplanir
- **⋯ menusu** ve **sag tik**: Faturayi gor, duzelt, sil
- Satira tiklamak yalnizca detay gosterir; duzenleme menuden yapilir

#### Fatura duzenleme
- **Faturayi duzelt** ile mevcut fatura acilir
- Listeden **kaleme tiklayarak** adet ve birim fiyat guncellenir
- Toplu faturaya urun eklenebilir; kaydedince eski kayit yenilenir

#### Stok girisi silme
- Yalnizca urunun **en son stok girisi** silinebilir
- Toplu faturada (SRB) bir satirdan **tum fatura** silinir
- Iade ve tedarikci borc odeme satirlari karismaz

### Onceki surumden (1.8.6 ozeti)
- Eksi stok duzeltmesi, eksik liste tedarikci filtresi, sepet +5/+10
`;
