/** Raft / kutu etiketinde tiklenebilir alanlar */

export type BarcodeLabelFieldId =
  | "productName"
  | "productNameBlack"
  | "companyName"
  | "description"
  | "domesticBadge"
  | "unitPriceLine"
  | "origin"
  | "fdt"
  | "price"
  | "vatStack"
  | "barcode";

export type BarcodeLabelFieldFlags = Record<BarcodeLabelFieldId, boolean>;

export const BARCODE_LABEL_FIELD_META: {
  id: Exclude<BarcodeLabelFieldId, "productNameBlack">;
  label: string;
  hint: string;
}[] = [
  { id: "productName", label: "Urun adi", hint: "Urun adi satiri" },
  { id: "companyName", label: "Firma adi", hint: "En ustte" },
  { id: "description", label: "Aciklama", hint: "Bos ise gizlenir" },
  { id: "domesticBadge", label: "Yerli uretim", hint: "Resmi Yerli Uretim logosu" },
  { id: "unitPriceLine", label: "Birim fiyat", hint: "1 Adet = … TL" },
  { id: "origin", label: "Mensei", hint: "Turkiye / Ithal" },
  { id: "fdt", label: "FDT", hint: "Fiyat tarihi" },
  { id: "price", label: "Buyuk fiyat", hint: "Orn. 40.00" },
  { id: "vatStack", label: "KDV / TL", hint: "KDV bilgisi" },
  { id: "barcode", label: "Barkod", hint: "Altta barkod" }
];

/** Urun adi tikinin altinda gosterilir */
export const PRODUCT_NAME_BLACK_META = {
  id: "productNameBlack" as const,
  label: "Siyah cerceve",
  hint: "Siyah zemin, beyaz yazi"
};

export const DEFAULT_BARCODE_LABEL_FIELDS: BarcodeLabelFieldFlags = {
  productName: true,
  productNameBlack: true,
  companyName: true,
  description: true,
  domesticBadge: true,
  unitPriceLine: true,
  origin: true,
  fdt: true,
  price: true,
  vatStack: true,
  barcode: true
};

const STORAGE_KEY = "marina-barcode-label-fields-v1";

export function loadBarcodeLabelFields(): BarcodeLabelFieldFlags {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BARCODE_LABEL_FIELDS };
    const parsed = JSON.parse(raw) as Partial<BarcodeLabelFieldFlags>;
    const next = { ...DEFAULT_BARCODE_LABEL_FIELDS };
    for (const key of Object.keys(DEFAULT_BARCODE_LABEL_FIELDS) as BarcodeLabelFieldId[]) {
      if (typeof parsed[key] === "boolean") next[key] = parsed[key]!;
    }
    return next;
  } catch {
    return { ...DEFAULT_BARCODE_LABEL_FIELDS };
  }
}

export function saveBarcodeLabelFields(flags: BarcodeLabelFieldFlags): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
  } catch {
    /* private mode / quota */
  }
}

/** Sol kolon satir sayisi — yogunluga gore yazi/barkod olcegi */
export function countLeftDetailLines(flags: BarcodeLabelFieldFlags, hasDomestic: boolean): number {
  let n = 0;
  if (flags.domesticBadge && hasDomestic) n += 1;
  if (flags.unitPriceLine) n += 1;
  if (flags.origin) n += 1;
  if (flags.fdt) n += 1;
  return n;
}
