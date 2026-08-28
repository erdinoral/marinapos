/** Raft / kutu etiket boyutlari — yeni boyut eklemek icin listeye satir ekleyin.
 * Font / bosluk birimleri mm: onizleme ile baski ayni fiziksel olcegi kullanir.
 */

export type BarcodeLabelSizeId = "60x40" | "100x100";

export type BarcodeLabelSize = {
  id: BarcodeLabelSizeId;
  label: string;
  widthMm: number;
  heightMm: number;
  /** Onizleme kutusu max genislik (px) */
  previewMaxPx: number;
  padding: string;
  gap: string;
  /** Aciklama altindaki ara — aciklama puntoya oranli */
  descGap: string;
  fonts: {
    company: string;
    /** Aciklama yokken (bos alan doldurulur) */
    companyAir: string;
    name: string;
    nameDense: string;
    nameAir: string;
    desc: string;
    detail: string;
    detailDense: string;
    detailAir: string;
    price: string;
    priceDense: string;
    priceAir: string;
    vat: string;
    gram: string;
    domText: string;
  };
  /** Resmi Yerli Uretim logosu yuksekligi (genislik oranli) */
  domLogoHeight: string;
  barcode: {
    heightDense: number;
    heightMid: number;
    heightOpen: number;
    /** Aciklama yokken en genis barkod */
    heightAir: number;
    barWidth: number;
  };
};

/** Aciklama / sol satir yogunluguna gore etiket olcegi */
export type BarcodeLabelLayoutScale = "dense" | "normal" | "air";

export function resolveBarcodeLabelLayoutScale(
  showDescription: boolean,
  leftLines: number,
  sizeId: BarcodeLabelSizeId = "60x40"
): BarcodeLabelLayoutScale {
  // 60x40: aciklama yoksa ad + fiyat air (barkod ayri sinirlanir)
  if (sizeId === "60x40" && !showDescription) return "air";
  // 100x100 / aciklamali: sol kolon kalabaliksa sikistir
  if (leftLines >= 3) return "dense";
  if (showDescription) return "normal";
  return "air";
}

/** Uzun fiyat rakamlari (orn. 2300.00) puntoyu kucultur — tasmayı onler */
export function fitPriceFontMm(
  baseMm: string,
  priceDigits: string,
  sizeId: BarcodeLabelSizeId = "60x40"
): string {
  const base = Number.parseFloat(String(baseMm));
  if (!Number.isFinite(base) || base <= 0) return baseMm;
  const digits = String(priceDigits ?? "").replace(/\D/g, "").length;
  let factor = 1;
  if (sizeId === "100x100") {
    // KDV/TL blogu yaninda son rakam kesilmesin
    if (digits >= 7) factor = 0.72;
    else if (digits >= 6) factor = 0.8;
    else if (digits >= 5) factor = 0.86;
    else if (digits >= 4) factor = 0.92;
  } else if (digits >= 7) factor = 0.82;
  else if (digits >= 6) factor = 0.9;
  else if (digits >= 5) factor = 0.95;
  const unit = String(baseMm).replace(/[\d.]/g, "") || "mm";
  return `${(base * factor).toFixed(2)}${unit}`;
}

export function fontsForLabelLayout(
  size: BarcodeLabelSize,
  scale: BarcodeLabelLayoutScale,
  leftLines = 0
) {
  // 100x100: sol detay hep kucuk, fiyat hep buyuk
  if (size.id === "100x100") {
    const name =
      scale === "air" ? size.fonts.nameAir : scale === "dense" ? size.fonts.nameDense : size.fonts.name;
    return {
      company: size.fonts.company,
      name,
      detail: size.fonts.detailDense,
      price: scale === "air" ? size.fonts.priceAir : size.fonts.price
    };
  }
  if (scale === "dense") {
    return {
      company: size.fonts.company,
      name: size.fonts.nameDense,
      detail: size.fonts.detailDense,
      price: size.fonts.priceDense
    };
  }
  if (scale === "air") {
    // Air'de detayi abartma — fiyat + barkod icin yer kalsin
    const detail = leftLines >= 2 ? size.fonts.detailDense : size.fonts.detailAir;
    return {
      company: size.fonts.company,
      name: size.fonts.nameAir,
      detail,
      price: size.fonts.priceAir
    };
  }
  return {
    company: size.fonts.company,
    name: size.fonts.name,
    detail: size.fonts.detail,
    price: size.fonts.price
  };
}

export function barcodeHeightForLabelLayout(
  size: BarcodeLabelSize,
  scale: BarcodeLabelLayoutScale,
  leftLines: number
): number {
  // 100x100: barkodu hep buyuk tut
  if (size.id === "100x100") {
    if (leftLines >= 3) return size.barcode.heightOpen;
    return size.barcode.heightAir;
  }
  // 60x40: barkodu okunabilir tut — dense olsa bile asiri kucultme
  if (scale === "dense" || leftLines >= 3) return size.barcode.heightMid;
  if (scale === "air") return leftLines >= 1 ? size.barcode.heightOpen : size.barcode.heightAir;
  return size.barcode.heightOpen;
}

export const BARCODE_LABEL_SIZES: BarcodeLabelSize[] = [
  {
    id: "60x40",
    label: "Raft 60×40",
    widthMm: 60,
    heightMm: 40,
    previewMaxPx: 340,
    padding: "0.7mm 1.4mm 0.45mm",
    gap: "0.25mm",
    descGap: "0.4mm",
    fonts: {
      company: "3.4mm",
      companyAir: "3.6mm",
      name: "4.85mm",
      nameDense: "4.4mm",
      nameAir: "5.95mm",
      desc: "4.45mm",
      detail: "2.5mm",
      detailDense: "2.2mm",
      detailAir: "2.55mm",
      price: "8.5mm",
      priceDense: "7.6mm",
      priceAir: "9.2mm",
      vat: "2.15mm",
      gram: "1.85mm",
      domText: "1.85mm"
    },
    domLogoHeight: "5.8mm",
    barcode: {
      heightDense: 22,
      heightMid: 26,
      heightOpen: 30,
      heightAir: 32,
      barWidth: 1.5
    }
  },
  {
    id: "100x100",
    label: "Kutu 100×100",
    widthMm: 100,
    heightMm: 100,
    previewMaxPx: 360,
    padding: "2.5mm 3.5mm 2mm",
    gap: "0.9mm",
    descGap: "0.9mm",
    fonts: {
      company: "4.6mm",
      companyAir: "5.1mm",
      name: "6.2mm",
      nameDense: "5.6mm",
      nameAir: "6.8mm",
      desc: "4.8mm",
      detail: "2.7mm",
      detailDense: "2.45mm",
      detailAir: "2.7mm",
      price: "12mm",
      priceDense: "11mm",
      priceAir: "12.8mm",
      vat: "2.8mm",
      gram: "2.5mm",
      domText: "2.5mm"
    },
    domLogoHeight: "10mm",
    barcode: {
      heightDense: 56,
      heightMid: 64,
      heightOpen: 72,
      heightAir: 80,
      barWidth: 2.45
    }
  }
];

const DEFAULT_SIZE_ID: BarcodeLabelSizeId = "60x40";
const STORAGE_KEY = "marina-barcode-label-size-v1";

export function getBarcodeLabelSize(id: BarcodeLabelSizeId | string | null | undefined): BarcodeLabelSize {
  return BARCODE_LABEL_SIZES.find((s) => s.id === id) ?? BARCODE_LABEL_SIZES[0]!;
}

export function loadBarcodeLabelSizeId(): BarcodeLabelSizeId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && BARCODE_LABEL_SIZES.some((s) => s.id === raw)) return raw as BarcodeLabelSizeId;
  } catch {
    /* ignore */
  }
  return DEFAULT_SIZE_ID;
}

export function saveBarcodeLabelSizeId(id: BarcodeLabelSizeId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* private mode / quota */
  }
}

export function formatLabelSizeMm(size: BarcodeLabelSize): string {
  return `${size.widthMm}×${size.heightMm} mm`;
}
