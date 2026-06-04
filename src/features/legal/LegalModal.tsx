import { useEffect } from "react";

export type LegalKind = "kvkk" | "privacy" | "terms";

interface Props {
  open: boolean;
  kind: LegalKind | null;
  onClose: () => void;
}

function legalTitle(kind: LegalKind): string {
  if (kind === "kvkk") return "KVKK Aydinlatma";
  if (kind === "privacy") return "Gizlilik Politikasi";
  return "Kullanim Kosullari";
}

function legalContent(kind: LegalKind): string[] {
  if (kind === "kvkk") {
    return [
      "Veri sorumlusu: Yazilimi kullanan isletme (ticari unvan ve iletisim bilgileri Hesap → Firma bilgileri bolumunde tutulabilir).",
      "Islenen veriler: Urun, stok, satis, musteri (ad, telefon, e-posta, adres, vergi bilgisi vb. — sizin girdiginiz olcude), kasa/kapanis ve gelir-gider kayitlari. Bu veriler asil olarak cihazinizdaki marina-pos.json dosyasinda saklanir.",
      "Lisans aktivasyonu aciksa: Cihaz kimligi, lisans anahtari ve kontrol zaman damgasi, yalnizca lisansin gecerliligini dogrulamak icin yapilandirilmis uzak sunucuya (or. Supabase) iletilebilir. Satis ve musteri listesi bu amacla gonderilmez.",
      "Hukuki sebep ve amac: Sozlesmenin ifasi ve mesru menfaat kapsaminda isletme operasyonu; lisans iletisimi ise hizmetin sunulmasi icin zorunlu teknik islem.",
      "Saklama: Veriler, siz silene veya yedekten geri yukleyene kadar yerelde kalir; yedek dosyalari da isletmenin kontrolundedir.",
      "Haklariniz (KVKK m.11): Isletmeye basvurarak erisim, duzeltme, silme ve itiraz taleplerinizi iletebilirsiniz; teknik silme/yedekleme islemleri uygulama uzerinden de yapilabilir.",
      "Yedekleme, cihaz guvenligi, yetkisiz erisimin onlenmesi ve kisisel veri envanterinin tutulmasi isletmenin sorumlulugundadir."
    ];
  }
  if (kind === "privacy") {
    return [
      "Genel ilke: Marina Nargile Otomasyon, satis ve stok verilerinizi is analizi veya reklam amaciyla toplamaz; is verileri yerelde islenir.",
      "Yerel veri: Urun, kategori, stok hareketi, satis gecmisi, musteri kayitlari, kapanis ve gelir-gider kayitlari cihazinizda tutulur. Gramajli satislarda stok dusumu, sepette onayladiginiz gram miktari uzerinden yapilir.",
      "Musteri kayitlari: Sepette secilen musteri (varsa) fis ile iliskilendirilir; musteri silindiginde gecmis fislerde yalnizca baglanti kaldirilir, tutarlar degismez.",
      "Yedekleme: Tam veya bolumlu yedek JSON dosyasi olusturabilirsiniz (urunler, satislar, stok vb.). Yedekler sizin sectiginiz klasorde saklanir; icerik uzerinde tam kontrol sizdedir. Geri yukleme yalnizca sectiginiz bolumleri degistirir.",
      "Lisans (varsa): Periyodik internet baglantisi ile lisans durumu kontrol edilir; offline calisma suresi yapilandirmaya baglidir. Lisans disi veri aktarimi yapilmaz.",
      "Disa aktarim: Excel, rapor ve fatura ciktilari yerel klasorlere yazilir; bu dosyalari kimlerin gorebilecegini siz yonetirsiniz.",
      "Paylasilan cihazlarda Windows kullanici hesabi ve dosya erisim izinlerini sinirlamaniz onerilir."
    ];
  }
  return [
    "Bu yazilim isletme ici satis, stok ve raporlama icin lisansli kullanim amaciyla sunulur.",
    "Dogru fiyat, gramaj, stok ve musteri bilgisi girisi ile duzenli yedekleme kullanicinin / isletmenin sorumlulugundadir.",
    "Geri yukleme, sectiginiz bolumleri mevcut verinin uzerine yazar; islem oncesi yedek almaniz onerilir. Lisansli kurulumlarda yetkisiz kopya veya paylasim yasaktir.",
    "Surum guncellemeleri yeni ozellikler veya duzeltmeler getirebilir; Ayarlar → Guncelleme Notlari bolumunden ozet bilgi alinabilir.",
    "Yetkisiz tersine muhendislik, lisans atlatma veya kotuye kullanim yasaktir."
  ];
}

export function LegalModal({ open, kind, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !kind) return null;

  const title = legalTitle(kind);
  const paragraphs = legalContent(kind);

  return (
    <div className="legal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="legal-title">
      <div className="legal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="legal-header">
          <h3 id="legal-title">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Kapat">
            ×
          </button>
        </div>
        <div className="legal-body">
          {paragraphs.map((p, idx) => (
            <p key={idx}>{p}</p>
          ))}
        </div>
        <div className="legal-footer">
          <p className="legal-version-note muted small">Metin surumu: 1.4 · Mayis 2026</p>
          <button type="button" onClick={onClose}>
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
