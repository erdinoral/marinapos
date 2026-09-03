/** Raft / kutu etiket boyutlari — yeni boyut eklemek icin listeye satir ekleyin.
 * Font / bosluk birimleri mm: onizleme ile baski ayni fiziksel olcegi kullanir.
 */

export type BarcodeLabelSizeId = "40x20" | "60x40" | "100x100";

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
    /** Eski air olcegi icin tutulur; artik kullanilmaz */
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
    heightAir: number;
    barWidth: number;
  };
};

/** Sol satir yogunluguna gore etiket olcegi — bos alan doldurma (air) yok */
export type BarcodeLabelLayoutScale = "dense" | "normal";

export function resolveBarcodeLabelLayoutScale(
  _showDescription: boolean,
  leftLines: number,
  _sizeId: BarcodeLabelSizeId = "60x40"
): BarcodeLabelLayoutScale {
  // Bos alan doldurma kapali: aciklama yok diye yazi buyutulmez
  if (leftLines >= 3) return "dense";
  return "normal";
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
  if (sizeId === "40x20") {
    if (digits >= 6) factor = 0.72;
    else if (digits >= 5) factor = 0.82;
    else if (digits >= 4) factor = 0.9;
  } else if (sizeId === "100x100") {
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
  _leftLines = 0
) {
  if (size.id === "100x100") {
    return {
      company: size.fonts.company,
      name: scale === "dense" ? size.fonts.nameDense : size.fonts.name,
      detail: size.fonts.detailDense,
      price: size.fonts.price
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
  if (size.id === "40x20") {
    return scale === "dense" || leftLines >= 2 ? size.barcode.heightDense : size.barcode.heightOpen;
  }
  if (size.id === "100x100") {
    return leftLines >= 3 ? size.barcode.heightOpen : size.barcode.heightMid;
  }
  if (scale === "dense" || leftLines >= 3) return size.barcode.heightMid;
  return size.barcode.heightOpen;
}

export const BARCODE_LABEL_SIZES: BarcodeLabelSize[] = [
  {
    id: "40x20",
    label: "Kucuk 40×20",
    widthMm: 40,
    heightMm: 20,
    previewMaxPx: 280,
    padding: "0.35mm 0.7mm 0.25mm",
    gap: "0.15mm",
    descGap: "0.2mm",
    fonts: {
      company: "1.55mm",
      companyAir: "1.55mm",
      name: "2.15mm",
      nameDense: "1.9mm",
      nameAir: "2.15mm",
      desc: "1.7mm",
      detail: "1.35mm",
      detailDense: "1.2mm",
      detailAir: "1.35mm",
      price: "3.4mm",
      priceDense: "3mm",
      priceAir: "3.4mm",
      vat: "1.15mm",
      gram: "1.05mm",
      domText: "1.05mm"
    },
    domLogoHeight: "2.8mm",
    barcode: {
      heightDense: 10,
      heightMid: 12,
      heightOpen: 13,
      heightAir: 13,
      barWidth: 0.85
    }
  },
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
      companyAir: "3.4mm",
      name: "4.85mm",
      nameDense: "4.4mm",
      nameAir: "4.85mm",
      desc: "4.45mm",
      detail: "2.5mm",
      detailDense: "2.2mm",
      detailAir: "2.5mm",
      price: "8.5mm",
      priceDense: "7.6mm",
      priceAir: "8.5mm",
      vat: "2.15mm",
      gram: "1.85mm",
      domText: "1.85mm"
    },
    domLogoHeight: "5.8mm",
    barcode: {
      heightDense: 22,
      heightMid: 26,
      heightOpen: 28,
      heightAir: 28,
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
      companyAir: "4.6mm",
      name: "6.2mm",
      nameDense: "5.6mm",
      nameAir: "6.2mm",
      desc: "4.8mm",
      detail: "2.7mm",
      detailDense: "2.45mm",
      detailAir: "2.7mm",
      price: "12mm",
      priceDense: "11mm",
      priceAir: "12mm",
      vat: "2.8mm",
      gram: "2.5mm",
      domText: "2.5mm"
    },
    domLogoHeight: "10mm",
    barcode: {
      heightDense: 52,
      heightMid: 58,
      heightOpen: 62,
      heightAir: 62,
      barWidth: 2.1
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
