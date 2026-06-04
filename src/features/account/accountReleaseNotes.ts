export const APP_VERSION = "1.8.0";
export const APP_RELEASE_DATE = "04 Haziran 2026";

/** Hesap → Surumler ekraninda kartlar */
export const APP_RELEASE_NOTES: { title: string; body: string }[] = [
  {
    title: "Musteri / Kafe ve fatura",
    body:
      "Gecmis satislardan fatura olusturma (onizleme, kayit). Musteri kartinda son alis icin Fatura. Son islemler listesinde Fatura dugmesi."
  },
  {
    title: "Tedarikci stok ve fatura",
    body:
      "Gelen / stok ekle: tedarikci urun listesi, sepet, tek fatura grubu (SRB). Gecmiste fatura tutari veya gelis fiyati toplami. Sepete ekle sag altta."
  },
  {
    title: "Cari ve borc",
    body:
      "Stok girisinde kismi tedarikci borcu; borc odeme (nakit/kart). Musteri borc tahsilati paneli. Tedarikci detayda maliyet / ciro / kar ozeti."
  },
  {
    title: "POS stok etiketi",
    body:
      "Tum urun kartlarinda stok miktari: yesil (yeterli), sari (10 adet ve alti), kirmizi (stok yok). Favori ve en cok satanlarda da."
  },
  {
    title: "Sepet hizli adet",
    body:
      "POS sepetinde ve gelen stok sepetinde +5 / +10 ile adet artirma. Birim TL ve Ind. % alanlari kompakt."
  },
  {
    title: "Stok ve arayuz",
    body:
      "Stok listesi kaydirma ve esit sutunlar. Duzenlenebilir uygulama basligi. Tutun icerikleri kartlari; hover icerik tam gorunur."
  },
  {
    title: "Gider kaydi",
    body: "Urun Ekle artik gidere yazmaz. Stok alim gideri yalnizca Stok → Stok ekle (veya gelen stok) ile kaydedilir."
  },
  {
    title: "Klavye ve guncelleme",
    body:
      "Windows/Electron klavye odak iyilestirmesi. Ayarlar: GitHub Release uzerinden otomatik surum kontrolu; veriler korunur."
  }
];

/** GitHub Release / electron-updater — docs/RELEASE-1.8.0.md ile uyumlu */
export const RELEASE_CHANGELOG_MD = `## Marina Nargile POS 1.8.0

Kurulu uygulamalar **Ayarlar → Guncelleme** uzerinden bu surumu indirebilir. Verileriniz (satis, stok, musteri, ayarlar) korunur; yine de yayin oncesi yedek almaniz onerilir.

### Yeni ozellikler

#### Musteri, kafe ve fatura
- Gecmis satislardan **fatura olusturma** (onizleme, kaydet, yazdir)
- Musteri/kafe kartinda son alis satiri icin **Fatura** dugmesi
- Son islemler listesinde fatura (200 kayit)

#### Tedarikci ve stok girisi
- **Gelen / stok ekle:** tedarikci secince o firmaya bagli urun listesi, sepet, tek fatura grubu (SRB)
- Sepette **+5 / +10** hizli adet; **Sepete ekle** urun detayinin sag altinda
- Tedarikci gecmisinde stok girisleri gruplanir; **fatura tutari** veya urun gelis fiyatindan hesaplanan tutar gorunur
- Urun/stok girisinde **kismi borc**; tedarikci borc odemesi (nakit/kart, not)
- Tedarikci detay: stok listesindeki gibi **maliyet / tahmini ciro / brut kar** ozeti

#### Musteri borc
- Musteri borc **tahsilat** paneli (nakit/kart, not)

#### POS ve stok gorunumu
- Tum urun kartlarinda **stok etiketi:** yesil (yeterli), sari (≤10 adet), kirmizi (stok yok)
- Sepet satirinda **+5 / +10** ile adet artirma; Birim TL ve Ind. % alanlari kompakt

#### Diger
- **Duzenlenebilir uygulama basligi** (Ayarlar)
- **Tutun icerikleri** ekrani: aroma kartlari, uzerine gelince icerik; duzenleme modali
- **Urun ekle** artik gidere yazmaz; gider yalnizca **Stok → Stok ekle** ile

### Iyilestirmeler
- Stok listesi kaydirma, ~15 satir gorunum, esit sutunlar
- Klavye odak sorunu (Windows/Electron) azaltildi
- Ayarlar: surumler ve geri bildirim butonlari tema ile uyumlu
- Tutun ekraninda hover icerik kutusu kesilmez; gereksiz arka panel kaldirildi

### Guncelleme
- GitHub Release uzerinden otomatik surum kontrolu (electron-updater)

### Teknik notlar
- Kurulum boyutu optimizasyonlari (onceki surumlerle birlikte)
- Lisans ve geri bildirim Supabase entegrasyonu (yapilandirmaya bagli)
`;
