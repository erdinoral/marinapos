import fs from "node:fs";
import path from "node:path";
import {
  CashflowEntry,
  CashflowKind,
  Category,
  CategorySaleUnit,
  Customer,
  CustomerKind,
  CustomerProductPrice,
  PaymentType,
  Product,
  SaleKind,
  Settings,
  StockCostLayer,
  Supplier,
  TobaccoAroma
} from "../types/models";
import { migrateFifoLayersForProducts } from "../utils/fifoStockCost";
import { gramPriceKurusMigrate } from "../utils/saleUnit";

export interface SaleItem {
  id: number;
  saleId: number;
  productId: number;
  qty: number;
  unitPriceKurus: number;
  lineTotalKurus: number;
  /** Satis anindaki birim gelis (kurus) */
  unitCostKurus: number;
  /** qty * unitCostKurus */
  lineCostKurus: number;
}

export interface Sale {
  id: number;
  createdAt: string;
  kind: SaleKind;
  cartName?: string;
  paymentType: PaymentType;
  subtotalKurus: number;
  /** Urun satirlari disi ek tutar (kurus) */
  extraFeeKurus?: number;
  paidAmountKurus: number;
  changeAmountKurus: number;
  debtAddedKurus?: number;
  debtPaidKurus?: number;
  customerId?: number;
}

export interface StockMovement {
  id: number;
  productId: number;
  type: "in" | "out" | "adjust";
  qty: number;
  note: string;
  createdAt: string;
  /** Stok girisi anindaki tedarikci (urun kartindan) */
  supplierId?: number;
  /** Bu partinin birim gelis maliyeti (kurus); gramda 1000 g paket */
  unitCostKurus?: number;
  /** Gidere yazilan tutar (kurus): urun bazli veya odenen fatura */
  lineCostKurus?: number;
  /** Birim fiyat × miktar (kurus); fatura modunda karsilastirma */
  catalogLineCostKurus?: number;
  costMode?: import("../types/models").StockCostMode;
  invoicePaidKurus?: number;
  amountPaidKurus?: number;
  debtAddedKurus?: number;
  cashflowEntryId?: number;
}

export interface Closure {
  id: number;
  closureDate: string;
  totalSalesCount: number;
  cashTotalKurus: number;
  cardTotalKurus: number;
  grossRevenueKurus: number;
  costTotalKurus: number;
  profitKurus: number;
  reportPath: string;
  openingCashKurus?: number;
  expectedCashKurus?: number;
  actualCashKurus?: number | null;
  cashDiffKurus?: number | null;
}

export interface MarinaStore {
  categories: Category[];
  suppliers: Supplier[];
  products: Product[];
  customers: Customer[];
  customerProductPrices: CustomerProductPrice[];
  sales: Sale[];
  saleItems: SaleItem[];
  stockMovements: StockMovement[];
  closures: Closure[];
  settings: Settings;
  tobaccoAromas: TobaccoAroma[];
  cashflowEntries: CashflowEntry[];
  stockCostLayers: StockCostLayer[];
  sequences: {
    productId: number;
    saleId: number;
    saleItemId: number;
    stockMovementId: number;
    closureId: number;
    categoryId: number;
    customerId: number;
    supplierId: number;
    tobaccoAromaId: number;
    cashflowEntryId: number;
    stockCostLayerId: number;
  };
}

export class JsonStore {
  private filePath: string;
  private data: MarinaStore;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.filePath = path.join(dataDir, "marina-pos.json");
    this.data = this.load();
  }

  private load(): MarinaStore {
    if (!fs.existsSync(this.filePath)) {
      return {
        categories: [],
        suppliers: [],
        products: [],
        customers: [],
        customerProductPrices: [],
        sales: [],
        saleItems: [],
        stockMovements: [],
        closures: [],
        settings: {
          openingTime: "09:00",
          closureTime: "23:00",
          lowStockThreshold: 10,
          openingCashKurus: 0,
          openingCashDate: "",
          companyName: "Marina Nargile Hookah World",
          companyAddress: "",
          companyPhone: "",
          companyEmail: "",
          taxOffice: "",
          taxNumber: "",
          licenseDeviceId: "",
          licenseLastOkAt: "",
          licenseActivationKey: ""
        },
        tobaccoAromas: [],
        cashflowEntries: [],
        stockCostLayers: [],
        sequences: {
          productId: 0,
          saleId: 0,
          saleItemId: 0,
          stockMovementId: 0,
          closureId: 0,
          categoryId: 0,
          customerId: 0,
          supplierId: 0,
          tobaccoAromaId: 0,
          cashflowEntryId: 0,
          stockCostLayerId: 0
        }
      };
    }
    const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf-8")) as Partial<MarinaStore>;
    const normalizeCategory = (c: Category): Category => ({
      id: c.id,
      name: c.name,
      saleUnit: (c.saleUnit === "gram" ? "gram" : "piece") as CategorySaleUnit
    });
    const normalizeCustomer = (c: Customer): Customer => ({
      id: Number(c.id) || 0,
      kind: (c.kind === "retail_regular" ? "retail_regular" : "wholesale") as CustomerKind,
      name: String(c.name ?? "").trim() || "Isimsiz",
      phone: String(c.phone ?? ""),
      note: String(c.note ?? ""),
      email: String(c.email ?? ""),
      companyName: String(c.companyName ?? ""),
      address: String(c.address ?? ""),
      district: String(c.district ?? ""),
      city: String(c.city ?? ""),
      taxOrVkn: String(c.taxOrVkn ?? ""),
      balanceOwedKurus: Math.max(0, Math.round(Number(c.balanceOwedKurus ?? 0))),
      suggestedDiscountPercent: Math.max(0, Math.min(100, Number(c.suggestedDiscountPercent ?? 0))),
      createdAt: String(c.createdAt ?? new Date().toISOString())
    });
    const customersNormalized = (parsed.customers ?? []).map((c) => normalizeCustomer(c as Customer)).filter((c) => c.id > 0);
    const maxCustomerId = customersNormalized.reduce((m, c) => Math.max(m, c.id), 0);
    const tobaccoAromas: TobaccoAroma[] = (parsed.tobaccoAromas ?? []).map((a) => {
      const r = a as Partial<TobaccoAroma>;
      return {
        id: Math.max(0, Math.floor(Number(r.id ?? 0))),
        name: String(r.name ?? "").trim() || "Adsiz",
        content: String(r.content ?? ""),
        imagePath: String(r.imagePath ?? ""),
        createdAt: String(r.createdAt ?? new Date().toISOString())
      };
    });
    const maxTobaccoAromaId = tobaccoAromas.reduce((m, t) => Math.max(m, t.id), 0);
    const suppliers: Supplier[] = (parsed.suppliers ?? []).map((s) => {
      const r = s as Partial<Supplier>;
      return {
        id: Math.max(0, Math.floor(Number(r.id ?? 0))),
        name: String(r.name ?? "").trim() || "Adsiz",
        note: String(r.note ?? ""),
        phone: String(r.phone ?? ""),
        email: String(r.email ?? ""),
        address: String(r.address ?? ""),
        district: String(r.district ?? ""),
        city: String(r.city ?? ""),
        taxOffice: String(r.taxOffice ?? ""),
        taxNumber: String(r.taxNumber ?? ""),
        balanceOwedKurus: Math.max(0, Math.round(Number(r.balanceOwedKurus ?? 0)))
      };
    });
    const maxSupplierId = suppliers.reduce((m, s) => Math.max(m, s.id), 0);
    const cashflowEntriesRaw = (parsed.cashflowEntries ?? []) as Partial<CashflowEntry>[];
    const cashflowEntries: CashflowEntry[] = cashflowEntriesRaw
      .map((r) => {
        const kind = r.kind as CashflowKind | undefined;
        const k =
          kind === "extra_income" || kind === "expense_daily" || kind === "expense_monthly" ? kind : "expense_daily";
        const entryDate = String(r.entryDate ?? "").trim().slice(0, 10);
        let billingMonth = String(r.billingMonth ?? "").trim().slice(0, 7);
        if (!/^\d{4}-\d{2}$/.test(billingMonth) && /^\d{4}-\d{2}-\d{2}$/.test(entryDate)) billingMonth = entryDate.slice(0, 7);
        if (!/^\d{4}-\d{2}$/.test(billingMonth)) billingMonth = "1970-01";
        const ed =
          /^\d{4}-\d{2}-\d{2}$/.test(entryDate) ? entryDate : k === "expense_monthly" ? `${billingMonth}-01` : "1970-01-01";
        const stockMovementIdRaw = (r as Partial<CashflowEntry>).stockMovementId;
        const stockMovementId =
          stockMovementIdRaw != null && Number.isFinite(Number(stockMovementIdRaw)) && Number(stockMovementIdRaw) > 0
            ? Math.floor(Number(stockMovementIdRaw))
            : undefined;
        return {
          id: Math.max(0, Math.floor(Number(r.id ?? 0))),
          kind: k,
          entryDate: ed,
          billingMonth,
          amountKurus: Math.max(0, Math.round(Number(r.amountKurus ?? 0))),
          category: String(r.category ?? "").trim() || (k === "extra_income" ? "Ek gelir" : "Gider"),
          note: String(r.note ?? ""),
          createdAt: String(r.createdAt ?? new Date().toISOString()),
          ...(stockMovementId != null ? { stockMovementId } : {})
        };
      })
      .filter((e) => e.id > 0 && e.amountKurus > 0);
    const maxCashflowEntryId = cashflowEntries.reduce((m, e) => Math.max(m, e.id), 0);
    const stockCostLayers: StockCostLayer[] = (parsed.stockCostLayers ?? []).map((row) => {
      const r = row as Partial<StockCostLayer>;
      return {
        id: Math.max(0, Math.floor(Number(r.id ?? 0))),
        productId: Math.max(0, Math.floor(Number(r.productId ?? 0))),
        qtyRemaining: Math.max(0, Math.round(Number(r.qtyRemaining ?? 0))),
        unitCostKurus: Math.max(0, Math.round(Number(r.unitCostKurus ?? 0))),
        createdAt: String(r.createdAt ?? new Date().toISOString()),
        ...(r.stockMovementId != null && Number(r.stockMovementId) > 0
          ? { stockMovementId: Math.floor(Number(r.stockMovementId)) }
          : {})
      };
    });
    const maxStockCostLayerId = stockCostLayers.reduce((m, l) => Math.max(m, l.id), 0);
    const categoriesNormalized = (parsed.categories ?? []).map((c) => normalizeCategory(c as Category));
    const categoryUnitById = new Map(categoriesNormalized.map((c) => [c.id, c.saleUnit]));

    const productsNormalized = (parsed.products ?? []).map((p) => {
      const priceKurusRaw = p.priceKurus ?? Math.round(((p as unknown as { price?: number }).price ?? 0) * 100);
      const rawCost = p.costPriceKurus;
      const pp = p as Partial<Product>;
      const categoryId = p.categoryId ?? 0;
      const isGram = categoryUnitById.get(categoryId) === "gram";
      const priceKurus = isGram ? gramPriceKurusMigrate(priceKurusRaw) : Math.max(0, Math.round(priceKurusRaw));
      const costPriceKurusRaw =
        rawCost != null && rawCost > 0 ? rawCost : priceKurus > 0 ? Math.round(priceKurus * 0.7) : 0;
      const costPriceKurus = isGram
        ? gramPriceKurusMigrate(Math.max(0, Math.round(costPriceKurusRaw)))
        : Math.max(0, Math.round(costPriceKurusRaw));
      const wholesalePriceKurus = Math.max(0, Math.round(Number(pp.wholesalePriceKurus ?? 0)));
      const alternatePriceKurus = Math.max(0, Math.round(Number(pp.alternatePriceKurus ?? 0)));
      return {
        ...p,
        categoryId,
        supplierId: Math.max(0, Math.floor(Number(pp.supplierId ?? 0))),
        priceKurus,
        costPriceKurus,
        discountPercent: Math.max(0, Math.min(100, Number(pp.discountPercent ?? 0))),
        material: pp.material ?? "",
        vatRatePercent: Math.max(0, Math.min(100, Number(pp.vatRatePercent ?? 20))),
        priceIncludesVat: pp.priceIncludesVat !== false,
        domesticMade: pp.domesticMade === true,
        lastPriceChangeAt: pp.lastPriceChangeAt ?? "",
        wholesalePriceKurus: isGram ? gramPriceKurusMigrate(wholesalePriceKurus) : wholesalePriceKurus,
        alternatePriceKurus: isGram ? gramPriceKurusMigrate(alternatePriceKurus) : alternatePriceKurus,
        posFavorite: pp.posFavorite === 1 ? 1 : 0,
        stockQty: Math.max(0, Math.round(Number(p.stockQty ?? 0)))
      };
    });

    const productCategoryById = new Map(productsNormalized.map((p) => [p.id, p.categoryId]));

    const customerProductPrices: CustomerProductPrice[] = (parsed.customerProductPrices ?? [])
      .map((row) => {
        const r = row as Partial<CustomerProductPrice>;
        const customerId = Math.max(0, Math.floor(Number(r.customerId ?? 0)));
        const productId = Math.max(0, Math.floor(Number(r.productId ?? 0)));
        let priceKurus = Math.max(0, Math.round(Number(r.priceKurus ?? 0)));
        const catId = productCategoryById.get(productId) ?? 0;
        if (categoryUnitById.get(catId) === "gram") priceKurus = gramPriceKurusMigrate(priceKurus);
        if (customerId <= 0 || productId <= 0 || priceKurus <= 0) return null;
        return {
          customerId,
          productId,
          priceKurus,
          updatedAt: String(r.updatedAt ?? new Date().toISOString())
        };
      })
      .filter((x): x is CustomerProductPrice => x != null);
    const store: MarinaStore = {
      categories: categoriesNormalized,
      suppliers,
      customers: customersNormalized,
      customerProductPrices,
      products: productsNormalized,
      sales: (parsed.sales ?? []).map((s) => {
        const rawCid = (s as Partial<Sale>).customerId;
        const customerId =
          rawCid != null && Number.isFinite(Number(rawCid)) && Number(rawCid) > 0 ? Math.floor(Number(rawCid)) : undefined;
        const extraFeeRaw = (s as Partial<Sale>).extraFeeKurus;
        const extraFeeKurus =
          extraFeeRaw != null && Number.isFinite(Number(extraFeeRaw)) ? Math.max(0, Math.round(Number(extraFeeRaw))) : undefined;
        const subtotalKurus = s.subtotalKurus ?? Math.round(((s as unknown as { subtotal?: number }).subtotal ?? 0) * 100);
        const paidAmountKurus = s.paidAmountKurus ?? Math.round(((s as unknown as { paidAmount?: number }).paidAmount ?? 0) * 100);
        const changeAmountKurus = s.changeAmountKurus ?? Math.round(((s as unknown as { changeAmount?: number }).changeAmount ?? 0) * 100);
        const debtRaw = (s as Partial<Sale>).debtAddedKurus;
        let debtAddedKurus =
          debtRaw != null && Number.isFinite(Number(debtRaw)) ? Math.max(0, Math.round(Number(debtRaw))) : undefined;
        if (debtAddedKurus == null && (s.kind ?? "sale") === "sale" && s.paymentType === "cash" && subtotalKurus > paidAmountKurus) {
          debtAddedKurus = subtotalKurus - paidAmountKurus;
        }
        return {
          ...s,
          kind: s.kind ?? "sale",
          cartName: (s as Partial<Sale>).cartName ?? "Sepet 1",
          subtotalKurus,
          paidAmountKurus,
          changeAmountKurus: Math.max(0, changeAmountKurus),
          ...(customerId != null ? { customerId } : {}),
          ...(extraFeeKurus != null && extraFeeKurus > 0 ? { extraFeeKurus } : {}),
          ...(debtAddedKurus != null && debtAddedKurus > 0 ? { debtAddedKurus } : {})
        };
      }),
      saleItems: (parsed.saleItems ?? []).map((i) => {
        const unitPriceKurus =
          i.unitPriceKurus ?? Math.round(((i as unknown as { unitPrice?: number }).unitPrice ?? 0) * 100);
        const lineTotalKurus =
          i.lineTotalKurus ?? Math.round(((i as unknown as { lineTotal?: number }).lineTotal ?? 0) * 100);
        const unitCostKurus = i.unitCostKurus ?? 0;
        const lineCostKurus = i.lineCostKurus ?? i.qty * unitCostKurus;
        return {
          ...i,
          unitPriceKurus,
          lineTotalKurus,
          unitCostKurus,
          lineCostKurus
        };
      }),
      stockMovements: (parsed.stockMovements ?? []).map((m) => {
        const row = m as Partial<StockMovement>;
        const costModeRaw = row.costMode;
        const costMode =
          costModeRaw === "invoice" || costModeRaw === "product" ? costModeRaw : undefined;
        return {
          ...row,
          id: Math.max(0, Math.floor(Number(row.id ?? 0))),
          productId: Math.max(0, Math.floor(Number(row.productId ?? 0))),
          type: row.type === "in" || row.type === "out" || row.type === "adjust" ? row.type : "in",
          qty: Math.max(0, Math.round(Number(row.qty ?? 0))),
          note: String(row.note ?? ""),
          createdAt: String(row.createdAt ?? new Date().toISOString()),
          ...(costMode ? { costMode } : {}),
          ...(row.invoicePaidKurus != null && Number(row.invoicePaidKurus) >= 0
            ? { invoicePaidKurus: Math.round(Number(row.invoicePaidKurus)) }
            : {}),
          ...(row.catalogLineCostKurus != null && Number(row.catalogLineCostKurus) >= 0
            ? { catalogLineCostKurus: Math.round(Number(row.catalogLineCostKurus)) }
            : {}),
          ...(row.cashflowEntryId != null && Number(row.cashflowEntryId) > 0
            ? { cashflowEntryId: Math.floor(Number(row.cashflowEntryId)) }
            : {})
        } as StockMovement;
      }),
      closures: (parsed.closures ?? []).map((c) => {
        const grossRevenueKurus =
          c.grossRevenueKurus ?? Math.round(((c as unknown as { grossRevenue?: number }).grossRevenue ?? 0) * 100);
        const costTotalKurus = c.costTotalKurus ?? 0;
        const profitKurus = c.profitKurus ?? grossRevenueKurus - costTotalKurus;
        return {
          ...c,
          cashTotalKurus: c.cashTotalKurus ?? Math.round(((c as unknown as { cashTotal?: number }).cashTotal ?? 0) * 100),
          cardTotalKurus: c.cardTotalKurus ?? Math.round(((c as unknown as { cardTotal?: number }).cardTotal ?? 0) * 100),
          grossRevenueKurus,
          costTotalKurus,
          profitKurus
        };
      }),
      settings: {
        openingTime: parsed.settings?.openingTime ?? "09:00",
        closureTime: parsed.settings?.closureTime ?? "23:00",
        lowStockThreshold: parsed.settings?.lowStockThreshold ?? 10,
        openingCashKurus: parsed.settings?.openingCashKurus ?? 0,
        openingCashDate: parsed.settings?.openingCashDate ?? "",
        companyName: parsed.settings?.companyName ?? "Marina Nargile Hookah World",
        companyAddress: parsed.settings?.companyAddress ?? "",
        companyPhone: parsed.settings?.companyPhone ?? "",
        companyEmail: parsed.settings?.companyEmail ?? "",
        taxOffice: parsed.settings?.taxOffice ?? "",
        taxNumber: parsed.settings?.taxNumber ?? "",
        licenseDeviceId: String(parsed.settings?.licenseDeviceId ?? ""),
        licenseLastOkAt: String(parsed.settings?.licenseLastOkAt ?? ""),
        licenseActivationKey: String(parsed.settings?.licenseActivationKey ?? "")
      },
      tobaccoAromas,
      cashflowEntries,
      stockCostLayers,
      sequences: {
        productId: parsed.sequences?.productId ?? 0,
        saleId: parsed.sequences?.saleId ?? 0,
        saleItemId: parsed.sequences?.saleItemId ?? 0,
        stockMovementId: parsed.sequences?.stockMovementId ?? 0,
        closureId: parsed.sequences?.closureId ?? 0,
        categoryId: parsed.sequences?.categoryId ?? 0,
        customerId: Math.max(parsed.sequences?.customerId ?? 0, maxCustomerId),
        supplierId: Math.max(parsed.sequences?.supplierId ?? 0, maxSupplierId),
        tobaccoAromaId: Math.max(parsed.sequences?.tobaccoAromaId ?? 0, maxTobaccoAromaId),
        cashflowEntryId: Math.max(parsed.sequences?.cashflowEntryId ?? 0, maxCashflowEntryId),
        stockCostLayerId: Math.max(parsed.sequences?.stockCostLayerId ?? 0, maxStockCostLayerId)
      }
    };
    migrateFifoLayersForProducts(store);
    return store;
  }

  save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
  }

  getState() {
    return this.data;
  }

  getFilePath() {
    return this.filePath;
  }

  reload() {
    this.data = this.load();
  }

  replaceState(next: MarinaStore) {
    this.data = next;
    this.save();
  }
}
