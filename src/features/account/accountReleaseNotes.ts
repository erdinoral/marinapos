export const APP_VERSION = "1.9.24";
export const APP_RELEASE_DATE = "28 Agustos 2026";

/** Hesap → Surumler ekraninda kartlar */
export const APP_RELEASE_NOTES: { title: string; body: string }[] = [
  {
    title: "Barkod baski = onizleme (1.9.24)",
    body:
      "100x100 etiket bos/beyaz basilma duzeltildi (yazdirma iframe opakligi). Onizlemedeki barkod SVG baskiya aktarilir; 60x40 ve 100x100 duzeni hizalandi."
  },
  {
    title: "Borc kaydet + yazici (1.9.23)",
    body:
      "Tedarikci / kafe / musteri borcunu elle degistirip Kaydet'e basinca kayit artik uygulanir (blur uyarisi Kaydet tikini yutuyordu). Ayni tuzak formlarda kaldirildi. Barkod ve eksik stok yazdirmada diyalog erken kapanmaz."
  },
  {
    title: "Mobil APK PC paketinden ayrildi (1.9.22)",
    body:
      "Setup artik mobil APK icermez (GitHub yukleme / boyut). APK ayri: data/mobile/marina-pos-mobile.apk. QR indirme ve mobil 2.0.2 cleartext duzeltmeleri gecerli."
  },
  {
    title: "Mobil APK QR + paket (1.9.21)",
    body:
      "APK QR indirme duzeltildi (dogru Wi-Fi IP, indirme sayfasi/header). Mobil 2.0.2 release HTTP (cleartext) acik. Etiket 60x40/100x100 ve dolar fiyat korumalari dahil."
  },
  {
    title: "Yazici + rapor + etiket duzeni (1.9.20)",
    body:
      "Barkod yazdirma guclendirildi (logo yuklenince basar, yedek yol diyalogu erken kapatmaz). Etikette fiyat/detay barkodun hemen ustunde. Rapor En Cok Satilanlar adetli ustte / gramajli altta, ciroya gore. Tedarikcide stok giris gecmisi ustte."
  },
  {
    title: "Etiket: Yerli logo + 60x40 yazi (1.9.19)",
    body:
      "Yerli uretim tikliyken resmi Yerli Uretim logosu etikete basilir. 60x40'ta urun adi ve aciklama buyutuldu; 100x100 onceki dengeli boyutta kaldi."
  },
  {
    title: "100x100 etiket yazi (1.9.18)",
    body:
      "Kutu 100x100 mm etiket yazi boyutlari onceki (iyi bulunan) ayara geri alindi. 60x40 raft etiketi ayni kaldi."
  },
  {
    title: "Yazdir asilma + etiket yazi (1.9.17)",
    body:
      "Yazdir dugmesi 'Yazdiriliyor...'da takili kaliyordu; yazici penceresi iframe ile acilir. Etiket yazilari (firma, urun, aciklama, detay, fiyat) bir kademe daha buyutuldu."
  },
  {
    title: "Etiket yazi boyutu (1.9.16)",
    body:
      "Barkod etiketinde firma, urun adi, aciklama, fiyat ve detay yazilari yeniden buyutuldu; mm olcegine geciste kuculen yazi duzeltildi."
  },
  {
    title: "Barkod Yazdir duzeltmesi (1.9.15)",
    body:
      "Yazdir dugmesi yazici penceresini artik gorunur acar; onceki surumde gizli pencereden diyalog acilmayabiliyordu. Basarisiz olursa yedek yazdirma yolu devreye girer."
  },
  {
    title: "Etiket duzeni + kapanis sirasi (1.9.14)",
    body:
      "Barkod etiketinde tum alan tikleri acilip kapanir. Aciklama buyudu; altindaki bosluk daraldi. Onizleme ve baski ayni mm olcekte. Kapanista Son satislar ustte, Satilan urunler altta."
  },
  {
    title: "Barkod yazdir + tutun ızgara (1.9.13)",
    body:
      "Stoktan barkod yazdir artik satis ile ayni (tikler bozulmuyordu). Yazdirma daha guvenilir. Tutun icerik kartlari satirda 10, fazlasi alta iner."
  },
  {
    title: "Borc uyarisi + etiket ve gecmis (1.9.12)",
    body:
      "Borc (TL) elle silinince/degisince perakende, kafe ve tedarikcide onay ister. Musteri gecmisinde Son islemler ustte. Barkod etiketinde firma adi buyudu; urun adi daha buyuk, siyah zemin beyaz yazi."
  },
  {
    title: "Dolar bazli urun + gelis kuru (1.9.11)",
    body:
      "Ithal urunlerde dolar bazli satis/gelis. Satis guncel USD/TRY kurundan; gelis 'hangi kurdan geldi' kayitli kurundan yuvarlanarak TL'ye cevrilir. POS sepette dolar urunler canli kur kullanir."
  },
  {
    title: "Barkod etiketi secenekleri (1.9.11)",
    body:
      "Etikette alan tikleri, canli onizleme, aciklama satiri, 60x40 ve 100x100 mm boyut secimi. POS sag tik menusu: Barkod yazdir. Firma adi urun adinin ustunde; barkod alta sabit."
  },
  {
    title: "Barkod etiketi 60x40 mm (1.9.10)",
    body:
      "Barkod yazdirma tek sayfada 60x40 mm etiket duzenine uyarlandi: urun adi, yerli uretim / FDT, buyuk fiyat + KDV, altta barkod. Onceki uzun form 3 sayfaya bolunmuyordu."
  },
  {
    title: "Stok tutari stokla birlikte (1.9.9)",
    body:
      "Stok azalinca / artinca alttaki maliyet ve 'satilirsa tahmini ciro' tutarlari guncellenir. Satirda adet altinda tahmini tutar gorunur. Birim fiyat ayni kalir; degisen toplam tutardir."
  },
  {
    title: "Satis disi urun stok kaydi (1.9.9)",
    body:
      "0 TL satis fiyatli urunlerde stok duzenleme sessizce iptal olmaz; kayit yapilir. Urun kartindan stok degisince FIFO maliyet katmanlari da esitlenir."
  },
  {
    title: "Indirim borca yazilmiyor (1.9.8)",
    body:
      "Satir Ind.% uygulanmis tutar artik dogru kaydedilir; musteri seciliyken indirim farki borca eklenmez."
  },
  {
    title: "Karma odeme otomatik kalan (1.9.8)",
    body:
      "Karma'da nakit veya kart tutarini yazinca kalan otomatik diger alana yazilir. Hesap makinesi gerekmez."
  },
  {
    title: "Mobil Ind.% ve karma (1.9.8)",
    body:
      "PC sepetindeki satir indirimi mobilde toplama yansir. Mobil karma odemede de kalan otomatik dolar."
  },
  {
    title: "PIN + guvenlik anahtari (1.9.7)",
    body:
      "Acilista uyelik zorunlu degil. PIN olustururken guvenlik anahtari belirlenir; PIN unutunca bu anahtar ile sifirlanir."
  },
  {
    title: "Guncelleme pop-up (1.9.7)",
    body:
      "Surum bildirimi sadece yeni surumde bir kez gosterilir; ayni surumde tekrar cikmaz."
  },
  {
    title: "Toplu fatura arama (1.9.6)",
    body:
      "Eslesmeyen harf basinca arama kutusu ve fatura kalemleri korunur."
  },
  {
    title: "Acilis guncelleme bildirimi (1.9.5)",
    body:
      "Surum notlari pop-up; otomatik veya elle kapanir."
  },
  {
    title: "Mobil barkod onayi (1.9.5)",
    body:
      "Barkod okutunca urun onizlenir; Sepete ekle veya Hizli mod."
  },
  {
    title: "Coklu sepet musteri (1.9.5)",
    body:
      "Her sepet kendi musterisini tutar."
  },
  {
    title: "Barkod yazdirma (1.9.4)",
    body:
      "Yazdir dugmesi Windows yazdirma penceresini acar."
  },
  {
    title: "Karma odeme (1.9.4)",
    body:
      "Ayni satista nakit + kart; kasa/kapanis ozetine ayrilir."
  },
  {
    title: "Kategori yonetimi (1.9.4)",
    body:
      "Kategoriden kaldir, harf cubugu, pasif urun engeli kaldirildi."
  },
  {
    title: "Tutar girisi tutarliligi (1.9.3)",
    body:
      "Turkce sayi formati tum formlarda tutarli."
  },
  {
    title: "Gelis fiyati ondalik (1.9.2)",
    body:
      "Kusuratli gelis fiyatlari dogru kaydedilir."
  },
  {
    title: "Gramajli urun indirimi (1.9.1)",
    body:
      "Ind. % satir toplamindan dusulur."
  },
  {
    title: "Mobil kasa senkronu (1.9.1)",
    body:
      "Mobil sepet PC kasasina yansir."
  },
  {
    title: "Fatura indirimi (1.9.0)",
    body:
      "POS indirimleri faturada dogru yansir."
  },
  {
    title: "Stok odenen tutar (1.8.9)",
    body:
      "Stok girisinde Odenen tutar alani."
  },
  {
    title: "Iade musteri secimi (1.8.9)",
    body:
      "Iadede onceki musteri otomatik secilir."
  },
  {
    title: "Lisans / guncelleme (1.8.8)",
    body:
      "Guncelleme sonrasi lisans sunucusu hatasi giderildi."
  },
  {
    title: "Stok fatura gruplama (1.8.7)",
    body:
      "Toplu fatura kalemleri tek satirda gruplanir."
  }
];

/** GitHub Release / electron-updater changelog */
export const RELEASE_CHANGELOG_MD = `## Marina Nargile POS 1.9.24

### Duzeltme
- 100x100 barkod etiketi bos/beyaz basilma duzeltildi
- Baski ciktisi onizleme ile ayni (barkod SVG ve duzen hizalandi)
`;
