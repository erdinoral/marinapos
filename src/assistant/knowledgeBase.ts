import type { FaqEntry } from "./types";

/** Uretim POS'a tasirken metinleri kendi is akisiniza gore duzenleyin. */
export const FAQ_ENTRIES: FaqEntry[] = [
  {
    id: "stock-add",
    title: "Yeni mal girisi (stok artisi)",
    keywords: [
      "stok ekle",
      "stok girisi",
      "mal girisi",
      "yeni stok",
      "gelis",
      "alis",
      "stok nasil eklenir",
      "stok nasil eklerim",
      "stok ekleme"
    ],
    body:
      "Yeni mal aliminda stogu urun kartindan degil, Stok sekmesindeki Stok Ekle panelinden artirin.\n\n" +
      "Boylece maliyet (FIFO katmani), istege bagli gider kaydi ve tedarikci borcu dogru islenir.\n\n" +
      "Urun duzenlemedeki stok alani sayim veya duzeltme icindir; yeni parti maliyeti icin kullanmayin."
  },
  {
    id: "fifo",
    title: "FIFO maliyet",
    keywords: ["fifo", "maliyet", "parti", "katman", "20 tl", "50 tl", "ortalama"],
    body:
      "Satislarda en eski maliyet katmani once tuketilir (FIFO).\n\n" +
      "Ornek: 30 adet 20 TL alim satildiktan sonra kalan stok 50 TL katmanindan maliyetlenir.\n\n" +
      "Ayni birim maliyetle gelen miktarlar son katmana eklenir; aktif maliyet eski katman bitene kadar degismez."
  },
  {
    id: "customer-debt",
    title: "Musteri borcu",
    keywords: ["musteri borc", "perakende borc", "toptan borc", "veresiye", "acik hesap"],
    body:
      "Eksik odemeli satislarda musteri bakiyesi artar. Borclu musteriler listede rozet ile gosterilir.\n\n" +
      "Tahsilat: musteri kartindan odeme veya tam tutarli yeni satis ile kapatabilirsiniz (POS is kurallarina gore)."
  },
  {
    id: "supplier-debt",
    title: "Tedarikci borcu",
    keywords: ["tedarikci borc", "kalan borc", "tedarikci odeme", "mal alimi borc"],
    body:
      "Stok eklerken odemediginiz kisim tedarikci bakiyesine yazilir (Odenen tutar alanindan hesaplanir).\n\n" +
      "Gider kaydi genelde odenen tutar kadar olur. Tedarikci listesinde borclu olanlar isaretlenir."
  },
  {
    id: "backup",
    title: "Yedekleme",
    keywords: ["yedek", "backup", "geri yukle", "restore"],
    body:
      "Ayarlardan moduler yedek alin. Geri yuklemeden once mevcut veriyi yedekleyin.\n\n" +
      "Katalog + stok + satis modulleri birlikte tutarli olmalidir; sadece tek modul geri yuklemek FIFO veya satis uyumsuzlugu yaratabilir."
  },
  {
    id: "closure",
    title: "Gun sonu kapanis",
    keywords: ["kapanis", "gun sonu", "kasa", "sayim"],
    body:
      "Kapanis sekmesinde gunluk satis ve kar ozetini kontrol edin; kasadaki nakit ile sistem tutarini karsilastirin.\n\n" +
      "Kapanis kaydi raporlarda saklanir."
  },
  {
    id: "gram-stock",
    title: "Gramajli urun",
    keywords: ["gram", "1000g", "kilogram", "tütün gram"],
    body:
      "Gram birimli urunlerde stok gram cinsindendir; fiyatlar genelde 1000 g basina verilir.\n\n" +
      "Deger hesaplari miktari 1000'e bolerek yapilir — adet gibi carpilmaz."
  },
  {
    id: "assistant-lab",
    title: "Bu panel ne?",
    keywords: ["asistan", "yardim", "lab", "test", "entegrasyon"],
    body:
      "Bu ekran POS asistan cekirdeginin deneme alanidir.\n\n" +
      "SSS metinleri + canli salt-okunur sorgular calisir; yapay zeka veya mock veri kullanilmaz.\n\n" +
      "Hazir oldugunda src/assistant klasorunu kendi POS projenize kopyalayip yalnizca veri adaptoru ve UI baglantisini yazmaniz yeterlidir."
  }
];

export const DEFAULT_SUGGESTIONS = [
  "Bugun kac satis?",
  "Eksik stoklar",
  "Musteri borcu",
  "Tedarikci borcu",
  "Stok nasil eklenir?",
  "FIFO nedir?"
];
