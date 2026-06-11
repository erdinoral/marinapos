export const APP_VERSION = "1.8.5";
export const APP_RELEASE_DATE = "11 Haziran 2026";

/** Hesap → Surumler ekraninda kartlar */
export const APP_RELEASE_NOTES: { title: string; body: string }[] = [
  {
    title: "Toplu fatura taslak",
    body:
      "Yarim kalan toplu fatura listesi kaybolmaz; baska sekmeye gecip donunce devam edin. Listeyi temizle ile sifirlayin."
  },
  {
    title: "Toplu fatura odeme",
    body:
      "Fatura altinda odenen tutar girilir; fark otomatik tedarikci borcuna yazilir. Urun satirindaki kalan borc alani kaldirildi."
  },
  {
    title: "Toplu fatura liste",
    body:
      "Acilir detay kaldirildi; her satirda +5/+10 ve Sil butonu. Listeyi temizle altta solda."
  },
  {
    title: "Urunu sil",
    body:
      "Urun duzenle penceresinde Urunu sil; urun satis ve stok listelerinden kaldirilir, gecmis kayitlar korunur."
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
  },
  {
    title: "Satis gecmisi (1.8.3)",
    body:
      "Stok → Gecmis ve analiz → Satis gecmisi; filtreler, detay, fatura ve iade icin sepete alma."
  }
];

/** GitHub Release / electron-updater changelog */
export const RELEASE_CHANGELOG_MD = `## Marina Nargile POS 1.8.5

Kurulu uygulamalar **Ayarlar → Guncelleme** uzerinden bu surumu indirebilir. Verileriniz korunur; yine de yayin oncesi yedek almaniz onerilir.

### Yeni

#### Toplu fatura — yarim kalan liste
- Listeye eklenen urunler **otomatik taslak** olarak saklanir (modal kapatma veya baska sekmeye gecme)
- **Toplu fatura** butonunda kalem sayisi rozeti; acinca *Yarim kalan liste yuklendi* uyarisi
- **Listeyi temizle** (altta solda) ile taslak ve liste sifirlanir
- Fatura **tamamlaninca** taslak otomatik silinir

#### Toplu fatura — odenen tutar
- Alttaki alan **Odenen tutar (TL)** olarak degisti
- Ornek: fatura 16.500 TL, odenen 11.500 TL → **5.000 TL** tedarikci borcuna yazilir
- Urun ekleme formundaki kalem borc alani kaldirildi (yalnizca fatura altindaki odenen tutar)

#### Toplu fatura — liste arayuzu
- Satir acilir detay kaldirildi
- Her satirda **+5 / +10** ve **Sil**; adet ve silme tek satirdan

#### Urun duzenle
- **Urunu sil** butonu eklendi (soft delete; sepetten de cikarilir)

### Onceki surumden (1.8.4 ozeti)
- Coklu tedarikci, AI Asistan yan paneli, stok listesi sabit ozet
- Satis gecmisi, moduler yedekleme, POS toptan fiyat
`;
