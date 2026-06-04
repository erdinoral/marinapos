export const APP_VERSION = "1.7.2";
export const APP_RELEASE_DATE = "04 Haziran 2026";

export const APP_RELEASE_NOTES: { title: string; body: string }[] = [
  {
    title: "Kurulum boyutu",
    body: "Gereksiz platform dosyalari (Mac/Linux), sharp ve fazla WASM kaldirildi. Kurulum yaklasik %30 daha kucuk."
  },
  {
    title: "Guncelleme (Ayarlar)",
    body: "Ayarlar ekraninda GitHub Release uzerinden surum kontrolu, indirme ve kurulum. Veriler (satis, stok, ayarlar) guncellemeden sonra korunur."
  },
  {
    title: "Gorus / geri bildirim",
    body: "Supabase gorus gonderimi iyilestirildi; gecmis mesajlar ac/kapa; gonderim sonrasi kisa onay. Goruntu hatasinda metin kaydi devam eder."
  },
  {
    title: "Stok ekrani",
    body: "Stok Ekle sag sutunda tam yukseklik; liste tiklama, sag tik menusu (gelen stok, sayim duzelt), gecmis satirdan birim gelis aktarma."
  },
  {
    title: "Satis (POS)",
    body: "Urun kartinda sag tik: urun duzenle, sayim duzelt, stok gelen. Sepette borc etiketleri kaldirildi (odeme mantigi ayni). Kafe musteri etiketi."
  },
  {
    title: "Musteriler ve cari",
    body: "Toptanci yerine Kafe; ortak iletisim formu; cari ve POS musteri akislari."
  },
  {
    title: "Ayarlar ve yedek",
    body: "Sayfa duzeni duzeltildi; uygulama ici yedekler katlanir panel; ust menu sabit."
  },
  {
    title: "Hesap ve lisans",
    body: "Hesap profili sekmeleri; uzaktan lisans ve Supabase gorus; yasal metinler."
  },
  {
    title: "Diger",
    body: "Tutun icerikleri, gelir-gider, fatura, barkod yazdirma, FIFO stok maliyeti, hata loglari ve asistan iyilestirmeleri."
  }
];
