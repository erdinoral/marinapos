import {
  Category,
  CategorySaleUnit,
  Product,
  ProductInput,
  StockAddInput,
  StockEntryLogRow,
  StockMovementLogRow,
  Supplier,
  SupplierInput,
  SupplierOverview
} from "../../types/models";
import { activeFifoUnitCostKurus, pushFifoLayer, resetFifoLayersToQty, reverseStockAddFifo } from "../../utils/fifoStockCost";
import { computeStockAddCosts, lineCostKurusFromUnit } from "../../utils/stockCost";
import { productHasSupplier, normalizeAlternateSupplierIds } from "../../utils/productSuppliers";
import { categorySaleUnitOf, formatQtyShort } from "../../utils/saleUnit";
import { JsonStore } from "../store";

const STOCK_PURCHASE_EXPENSE_CATEGORY = "Mal alimi / stok";

export class ProductRepository {
  constructor(private store: JsonStore) {}

  /** Stok aliminda odenen tutari gunluk gidere yazar (Stok ekle; Urun Ekle degil). */
  private recordStockPurchaseExpense(
    state: ReturnType<JsonStore["getState"]>,
    opts: {
      amountKurus: number;
      productName: string;
      qtyLabel: string;
      stockMovementId: number;
      supplierName?: string;
      noteExtra?: string;
      entryDate?: string;
    }
  ): number | undefined {
    const amountKurus = Math.max(0, Math.round(opts.amountKurus));
    if (amountKurus <= 0) return undefined;
    state.sequences.cashflowEntryId += 1;
    const cashflowEntryId = state.sequences.cashflowEntryId;
    const today = opts.entryDate ?? new Date().toISOString().slice(0, 10);
    const note = [opts.productName, opts.qtyLabel, opts.supplierName, opts.noteExtra].filter(Boolean).join(" · ");
    state.cashflowEntries.push({
      id: cashflowEntryId,
      kind: "expense_daily",
      entryDate: today,
      billingMonth: today.slice(0, 7),
      amountKurus,
      category: STOCK_PURCHASE_EXPENSE_CATEGORY,
      note,
      createdAt: new Date().toISOString(),
      stockMovementId: opts.stockMovementId
    });
    return cashflowEntryId;
  }

  list(): Product[] {
    return this.store
      .getState()
      .products.filter((x) => x.isActive === 1)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Iade gibi islemler icin; pasif urunler dahil */
  getById(productId: number): Product | null {
    const p = this.store.getState().products.find((x) => x.id === productId);
    if (!p) return null;
    return {
      ...p,
      alternateSupplierIds: normalizeAlternateSupplierIds(p.alternateSupplierIds, p.supplierId)
    };
  }

  listCategories() {
    return this.store
      .getState()
      .categories.slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  listStockCostLayers() {
    return this.store.getState().stockCostLayers.slice();
  }

  listSuppliers(): Supplier[] {
    return this.store
      .getState()
      .suppliers.slice()
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }

  createSupplier(payload: SupplierInput): Supplier {
    const normalized = String(payload.name ?? "").trim();
    if (!normalized) throw new Error("Tedarikci adi bos olamaz.");
    const state = this.store.getState();
    const existing = state.suppliers.find((x) => x.name.toLowerCase() === normalized.toLowerCase());
    if (existing) return { ...existing };
    state.sequences.supplierId += 1;
    const created: Supplier = {
      id: state.sequences.supplierId,
      name: normalized,
      note: String(payload.note ?? "").trim(),
      phone: String(payload.phone ?? "").trim(),
      email: String(payload.email ?? "").trim(),
      address: String(payload.address ?? "").trim(),
      district: String(payload.district ?? "").trim(),
      city: String(payload.city ?? "").trim(),
      taxOffice: String(payload.taxOffice ?? "").trim(),
      taxNumber: String(payload.taxNumber ?? "").trim(),
      balanceOwedKurus: Math.max(0, Math.round(Number(payload.balanceOwedKurus ?? 0)))
    };
    state.suppliers.push(created);
    this.store.save();
    return { ...created };
  }

  updateSupplier(supplierId: number, patch: Partial<SupplierInput>): Supplier | null {
    const state = this.store.getState();
    const s = state.suppliers.find((x) => x.id === supplierId);
    if (!s) return null;
    if (patch.name != null) {
      const n = String(patch.name).trim();
      if (!n) throw new Error("Tedarikci adi bos olamaz.");
      const dup = state.suppliers.some((x) => x.id !== supplierId && x.name.toLowerCase() === n.toLowerCase());
      if (dup) throw new Error("Bu isimde baska tedarikci var.");
      s.name = n;
    }
    if (patch.note != null) s.note = String(patch.note).trim();
    if (patch.phone != null) s.phone = String(patch.phone).trim();
    if (patch.email != null) s.email = String(patch.email).trim();
    if (patch.address != null) s.address = String(patch.address).trim();
    if (patch.district != null) s.district = String(patch.district).trim();
    if (patch.city != null) s.city = String(patch.city).trim();
    if (patch.taxOffice != null) s.taxOffice = String(patch.taxOffice).trim();
    if (patch.taxNumber != null) s.taxNumber = String(patch.taxNumber).trim();
    if (patch.balanceOwedKurus != null) {
      s.balanceOwedKurus = Math.max(0, Math.round(Number(patch.balanceOwedKurus)));
    }
    this.store.save();
    return { ...s };
  }

  deleteSupplier(supplierId: number) {
    const state = this.store.getState();
    if (state.products.some((p) => p.isActive === 1 && productHasSupplier(p, supplierId))) {
      throw new Error("Bu tedarikciye bagli aktif urun var; once urunlerden tedarikciyi cikartin.");
    }
    const before = state.suppliers.length;
    state.suppliers = state.suppliers.filter((s) => s.id !== supplierId);
    if (before === state.suppliers.length) throw new Error("Tedarikci bulunamadi.");
    for (const p of state.products) {
      if (p.supplierId === supplierId) p.supplierId = 0;
      if (p.alternateSupplierIds?.length) {
        p.alternateSupplierIds = p.alternateSupplierIds.filter((id) => id !== supplierId);
      }
    }
    this.store.save();
  }

  updateCategory(categoryId: number, patch: Partial<{ name: string; saleUnit: CategorySaleUnit }>): Category | null {
    const state = this.store.getState();
    const cat = state.categories.find((c) => c.id === categoryId);
    if (!cat) return null;
    if (patch.name != null) {
      const n = String(patch.name).trim();
      if (!n) throw new Error("Kategori adi bos olamaz.");
      const dup = state.categories.some((x) => x.id !== categoryId && x.name.toLowerCase() === n.toLowerCase());
      if (dup) throw new Error("Bu isimde baska kategori var.");
      cat.name = n;
    }
    if (patch.saleUnit != null) {
      const unit: CategorySaleUnit = patch.saleUnit === "gram" ? "gram" : "piece";
      if (unit !== cat.saleUnit) {
        const hasProducts = state.products.some((p) => p.categoryId === categoryId && p.isActive === 1);
        if (hasProducts) {
          throw new Error("Satis birimi degistirmek icin once bu kategorideki urunleri baska kategoriye tasiyin.");
        }
        cat.saleUnit = unit;
      }
    }
    this.store.save();
    return { ...cat };
  }

  createCategory(name: string, saleUnit: CategorySaleUnit = "piece"): Category {
    const normalized = name.trim();
    if (!normalized) throw new Error("Kategori adi bos olamaz.");
    const unit: CategorySaleUnit = saleUnit === "gram" ? "gram" : "piece";
    const state = this.store.getState();
    const existing = state.categories.find((x) => x.name.toLowerCase() === normalized.toLowerCase());
    if (existing) {
      return { ...existing };
    }
    state.sequences.categoryId += 1;
    const created: Category = { id: state.sequences.categoryId, name: normalized, saleUnit: unit };
    state.categories.push(created);
    this.store.save();
    return created;
  }

  create(payload: ProductInput) {
    const state = this.store.getState();
    const bc = payload.barcode.trim().toLowerCase();
    const cd = payload.code.trim().toLowerCase();
    if (!bc || !cd) throw new Error("Barkod ve kod bos olamaz.");
    if (state.products.some((p) => p.barcode.trim().toLowerCase() === bc)) {
      throw new Error("Bu barkod baska bir urunde kayitli.");
    }
    if (state.products.some((p) => p.code.trim().toLowerCase() === cd)) {
      throw new Error("Bu urun kodu baska bir urunde kayitli.");
    }
    state.sequences.productId += 1;
    const newId = state.sequences.productId;
    const nowIso = new Date().toISOString();
    const cat = state.categories.find((c) => c.id === payload.categoryId);
    const stockQty =
      cat?.saleUnit === "gram"
        ? Math.max(0, Math.round(Number(payload.stockQty) || 0))
        : Number(payload.stockQty) || 0;
    if (cat?.saleUnit === "gram" && stockQty > 0 && !Number.isInteger(stockQty)) {
      throw new Error("Gram stok tam sayi olmalidir.");
    }
    state.products.push({
      id: newId,
      ...payload,
      stockQty,
      discountPercent: Math.max(0, Math.min(100, Number(payload.discountPercent ?? 0))),
      material: (payload.material ?? "").trim(),
      vatRatePercent: Math.max(0, Math.min(100, Number(payload.vatRatePercent ?? 20))),
      priceIncludesVat: Boolean(payload.priceIncludesVat),
      domesticMade: payload.domesticMade === true,
      lastPriceChangeAt: nowIso,
      wholesalePriceKurus: Math.max(0, Math.round(Number(payload.wholesalePriceKurus ?? 0))),
      alternatePriceKurus: Math.max(0, Math.round(Number(payload.alternatePriceKurus ?? 0))),
      posFavorite: payload.posFavorite === 1 ? 1 : 0,
      supplierId: Math.max(0, Math.floor(Number(payload.supplierId ?? 0))),
      alternateSupplierIds: normalizeAlternateSupplierIds(
        payload.alternateSupplierIds,
        Math.max(0, Math.floor(Number(payload.supplierId ?? 0)))
      ),
      isActive: 1
    });
    if (payload.stockQty > 0) {
      const supplierId = Math.max(0, Math.floor(Number(payload.supplierId ?? 0)));
      const unitCost = Math.max(0, Math.round(Number(payload.costPriceKurus ?? 0)));
      const saleUnit = cat?.saleUnit === "gram" ? "gram" : "piece";
      const lineCostKurus = unitCost > 0 ? lineCostKurusFromUnit(unitCost, stockQty, saleUnit) : 0;
      let remainingDebtKurus = 0;
      if (payload.initialStockRemainingDebtKurus != null) {
        const d = Number(payload.initialStockRemainingDebtKurus);
        if (!Number.isFinite(d) || d < 0) throw new Error("Kalan borc gecersiz.");
        remainingDebtKurus = Math.round(d);
      }
      if (remainingDebtKurus > lineCostKurus) {
        throw new Error("Kalan borc alis tutarindan fazla olamaz.");
      }
      if (remainingDebtKurus > 0 && supplierId <= 0) {
        throw new Error("Borc icin tedarikci secin.");
      }
      const amountPaidKurus = lineCostKurus - remainingDebtKurus;
      const supplier = supplierId > 0 ? state.suppliers.find((s) => s.id === supplierId) : undefined;
      state.sequences.stockMovementId += 1;
      const movementId = state.sequences.stockMovementId;
      let movementNote = "Ilk stok (urun olusturma)";
      if (remainingDebtKurus > 0 && supplier) {
        supplier.balanceOwedKurus += remainingDebtKurus;
        movementNote += `; kalan borc ${(remainingDebtKurus / 100).toFixed(2)} TL`;
      }
      state.stockMovements.push({
        id: movementId,
        productId: newId,
        type: "in",
        qty: payload.stockQty,
        note: movementNote,
        createdAt: new Date().toISOString(),
        costMode: "product",
        ...(supplierId > 0 ? { supplierId } : {}),
        ...(unitCost > 0 ? { unitCostKurus: unitCost, lineCostKurus, catalogLineCostKurus: lineCostKurus } : {}),
        ...(lineCostKurus > 0 ? { amountPaidKurus } : {}),
        ...(remainingDebtKurus > 0 ? { debtAddedKurus: remainingDebtKurus } : {})
      });
      if (unitCost > 0) {
        pushFifoLayer(state, newId, stockQty, unitCost, saleUnit, movementId);
      }
    }
    this.store.save();
  }

  update(productId: number, patch: Partial<ProductInput>) {
    const state = this.store.getState();
    const product = state.products.find((p) => p.id === productId);
    if (!product) throw new Error("Urun bulunamadi.");
    if (patch.barcode != null) {
      const bc = String(patch.barcode).trim();
      if (!bc) throw new Error("Barkod bos olamaz.");
      const exists = state.products.some((p) => p.id !== productId && p.barcode.trim().toLowerCase() === bc.toLowerCase());
      if (exists) throw new Error("Bu barkod baska bir urunde kayitli.");
      product.barcode = bc;
    }
    if (patch.code != null) {
      const cd = String(patch.code).trim();
      if (!cd) throw new Error("Kod bos olamaz.");
      const exists = state.products.some((p) => p.id !== productId && p.code.trim().toLowerCase() === cd.toLowerCase());
      if (exists) throw new Error("Bu urun kodu baska bir urunde kayitli.");
      product.code = cd;
    }
    if (patch.categoryId != null) {
      const categoryId = Math.max(0, Math.floor(Number(patch.categoryId)));
      if (categoryId <= 0) throw new Error("Kategori secimi gecersiz.");
      product.categoryId = categoryId;
    }
    if (patch.priceKurus != null) {
      const next = Math.max(0, Math.round(patch.priceKurus));
      if (next !== product.priceKurus) product.lastPriceChangeAt = new Date().toISOString();
      product.priceKurus = next;
    }
    if (patch.costPriceKurus != null) product.costPriceKurus = Math.max(0, Math.round(patch.costPriceKurus));
    if (patch.name != null) {
      const n = String(patch.name).trim();
      if (!n) throw new Error("Urun adi bos olamaz.");
      product.name = n;
    }
    if (patch.description != null) product.description = String(patch.description).trim();
    if (patch.imagePath != null) product.imagePath = String(patch.imagePath);
    if (patch.supplierId != null) {
      product.supplierId = Math.max(0, Math.floor(Number(patch.supplierId)));
    }
    if ("alternateSupplierIds" in patch) {
      product.alternateSupplierIds = normalizeAlternateSupplierIds(patch.alternateSupplierIds, product.supplierId);
    } else if (patch.supplierId != null) {
      product.alternateSupplierIds = normalizeAlternateSupplierIds(product.alternateSupplierIds, product.supplierId);
    }
    if (patch.discountPercent != null) {
      product.discountPercent = Math.max(0, Math.min(100, Number(patch.discountPercent)));
    }
    if (patch.material != null) product.material = String(patch.material).trim();
    if (patch.vatRatePercent != null) product.vatRatePercent = Math.max(0, Math.min(100, Number(patch.vatRatePercent)));
    if (patch.priceIncludesVat != null) product.priceIncludesVat = Boolean(patch.priceIncludesVat);
    if (patch.domesticMade != null) product.domesticMade = Boolean(patch.domesticMade);
    if (patch.wholesalePriceKurus != null) product.wholesalePriceKurus = Math.max(0, Math.round(patch.wholesalePriceKurus));
    if (patch.alternatePriceKurus != null) product.alternatePriceKurus = Math.max(0, Math.round(patch.alternatePriceKurus));
    if (patch.posFavorite != null) product.posFavorite = patch.posFavorite === 1 ? 1 : 0;
    if (patch.stockQty != null) {
      const cat = state.categories.find((c) => c.id === product.categoryId);
      let nextStock = Number(patch.stockQty);
      if (!Number.isFinite(nextStock) || nextStock < 0) throw new Error("Stok miktari gecersiz.");
      if (cat?.saleUnit === "gram") {
        nextStock = Math.round(nextStock);
        if (!Number.isInteger(nextStock)) throw new Error("Gram stok tam sayi olmalidir.");
      }
      product.stockQty = nextStock;
    }
    this.store.save();
  }

  softDelete(productId: number) {
    const state = this.store.getState();
    const product = state.products.find((p) => p.id === productId);
    if (!product) throw new Error("Urun bulunamadi.");
    product.isActive = 0;
    this.store.save();
  }

  deleteCategory(categoryId: number) {
    const state = this.store.getState();
    if (state.products.some((p) => p.categoryId === categoryId)) {
      throw new Error("Bu kategoride urun var; once urunleri baska kategoriye alin veya silin.");
    }
    const before = state.categories.length;
    state.categories = state.categories.filter((c) => c.id !== categoryId);
    if (state.categories.length === before) throw new Error("Kategori bulunamadi.");
    this.store.save();
  }

  addStock(productId: number, quantity: number, input: StockAddInput) {
    const state = this.store.getState();
    const product = state.products.find((p) => p.id === productId);
    if (!product) throw new Error("Urun bulunamadi.");
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("Stok miktari gecersiz.");
    }
    const cat = state.categories.find((c) => c.id === product.categoryId);
    const saleUnit = categorySaleUnitOf(state.categories, product.categoryId);
    if (saleUnit === "piece" && !Number.isInteger(quantity)) {
      throw new Error("Adetli urunlerde miktar tam sayi olmalidir.");
    }
    if (saleUnit === "gram") {
      quantity = Math.round(quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error("Gram miktar tam sayi olmalidir.");
      }
    }

    const costMode = input.costMode === "invoice" ? "invoice" : "product";
    const explicitSupplierId = Math.floor(Number(input.supplierId ?? 0));
    if (explicitSupplierId <= 0 || !state.suppliers.some((s) => s.id === explicitSupplierId)) {
      throw new Error("Tedarikci bulunamadi.");
    }
    if (!productHasSupplier(product, explicitSupplierId)) {
      throw new Error("Secilen tedarikci bu urun kartinda tanimli degil.");
    }
    const supplier = state.suppliers.find((s) => s.id === explicitSupplierId);

    const cardUnit = Math.max(0, Math.round(Number(product.costPriceKurus) || 0));
    const incRaw = input.unitCostKurus == null ? undefined : Number(input.unitCostKurus);
    let unitCatalogKurus = cardUnit;
    if (incRaw !== undefined) {
      if (!Number.isFinite(incRaw) || incRaw < 0) {
        throw new Error("Birim gelis (maliyet) gecersiz.");
      }
      unitCatalogKurus = Math.round(incRaw);
    }

    const costs = computeStockAddCosts({
      costMode,
      qty: quantity,
      saleUnit,
      unitCatalogKurus,
      invoicePaidKurus: input.invoicePaidKurus == null ? undefined : Number(input.invoicePaidKurus)
    });

    let movementNote =
      costMode === "invoice"
        ? "Stok ekleme; odenen fatura tutari ile maliyet"
        : "Stok ekleme; urun bazli birim fiyat";
    if (costMode === "invoice" && costs.catalogLineCostKurus !== costs.lineCostKurus) {
      movementNote += " (liste ile farkli)";
    }
    movementNote += "; FIFO parti";
    if (supplier) movementNote += ` · ${supplier.name}`;

    product.stockQty += quantity;
    state.sequences.stockMovementId += 1;
    const movementId = state.sequences.stockMovementId;

    let remainingDebtKurus = 0;
    if (input.remainingDebtKurus != null) {
      const d = Number(input.remainingDebtKurus);
      if (!Number.isFinite(d) || d < 0) throw new Error("Kalan borc gecersiz.");
      remainingDebtKurus = Math.round(d);
    }
    if (remainingDebtKurus > costs.lineCostKurus) {
      throw new Error("Kalan borc, alis tutarindan fazla olamaz.");
    }
    const amountPaidKurus = costs.lineCostKurus - remainingDebtKurus;

    const recordExpense = input.recordExpense !== false;
    const cashflowEntryId =
      recordExpense && amountPaidKurus > 0
        ? this.recordStockPurchaseExpense(state, {
            amountKurus: amountPaidKurus,
            productName: product.name,
            qtyLabel: formatQtyShort(quantity, saleUnit),
            stockMovementId: movementId,
            supplierName: supplier?.name,
            noteExtra: [
              costMode === "invoice" ? "Odenen fatura" : "Urun bazli",
              remainingDebtKurus > 0 ? `Odenen ${(amountPaidKurus / 100).toFixed(2)} TL` : ""
            ]
              .filter(Boolean)
              .join(" · ")
          })
        : undefined;

    if (remainingDebtKurus > 0 && supplier) {
      supplier.balanceOwedKurus += remainingDebtKurus;
      movementNote += `; kalan borc ${(remainingDebtKurus / 100).toFixed(2)} TL`;
    }

    const receiveBatchId =
      typeof input.receiveBatchId === "string" && input.receiveBatchId.trim()
        ? input.receiveBatchId.trim()
        : undefined;
    if (receiveBatchId) {
      movementNote += ` · Grup ${receiveBatchId}`;
    }
    state.stockMovements.push({
      id: movementId,
      productId,
      type: "in",
      qty: quantity,
      note: movementNote,
      createdAt: new Date().toISOString(),
      supplierId: explicitSupplierId,
      unitCostKurus: costs.unitCostRecorded,
      lineCostKurus: costs.lineCostKurus,
      catalogLineCostKurus: costs.catalogLineCostKurus,
      costMode,
      amountPaidKurus,
      ...(remainingDebtKurus > 0 ? { debtAddedKurus: remainingDebtKurus } : {}),
      ...(costMode === "invoice" ? { invoicePaidKurus: costs.lineCostKurus } : {}),
      ...(cashflowEntryId != null ? { cashflowEntryId } : {}),
      ...(receiveBatchId ? { receiveBatchId } : {})
    });
    pushFifoLayer(state, productId, quantity, costs.unitCostRecorded, saleUnit, movementId);
    this.store.save();
  }

  adjustStock(productId: number, countedQty: number, note = "") {
    const state = this.store.getState();
    const product = state.products.find((p) => p.id === productId);
    if (!product) return;
    if (!Number.isFinite(countedQty) || countedQty < 0) {
      throw new Error("Sayim miktari gecersiz.");
    }
    const cat = state.categories.find((c) => c.id === product.categoryId);
    if (cat?.saleUnit === "gram") {
      countedQty = Math.round(countedQty);
      if (!Number.isInteger(countedQty)) {
        throw new Error("Gram stok tam sayi olmalidir.");
      }
    }
    const previousQty = product.stockQty;
    const diff = countedQty - previousQty;
    if (diff === 0) return;
    product.stockQty = countedQty;
    state.sequences.stockMovementId += 1;
    const sign = diff > 0 ? "+" : "-";
    const normalizedNote = note.trim();
    const movementNote = normalizedNote
      ? `Sayim duzeltme (${sign}${Math.abs(diff)}): ${normalizedNote}`
      : `Sayim duzeltme (${sign}${Math.abs(diff)})`;
    state.stockMovements.push({
      id: state.sequences.stockMovementId,
      productId,
      type: "adjust",
      qty: Math.abs(diff),
      note: movementNote,
      createdAt: new Date().toISOString()
    });
    const saleUnit = cat?.saleUnit === "gram" ? "gram" : "piece";
    const unit =
      activeFifoUnitCostKurus(state, productId) || Math.max(0, Math.round(Number(product.costPriceKurus) || 0));
    resetFifoLayersToQty(state, productId, countedQty, unit, saleUnit);
    this.store.save();
  }

  lowStock(): Product[] {
    const state = this.store.getState();
    const th = state.settings.lowStockThreshold;
    return state.products
      .filter((x) => {
        if (x.isActive !== 1) return false;
        const cat = state.categories.find((c) => c.id === x.categoryId);
        if (cat?.saleUnit === "gram") return false;
        const limit = th;
        return x.stockQty < limit;
      })
      .sort((a, b) => a.stockQty - b.stockQty);
  }

  /** Stok girisi kaydini geri alir: stok, FIFO, gunluk gider ve tedarikci borcu. Yalnizca urunun en son girisi silinebilir. */
  deleteStockEntry(movementId: number): void {
    const state = this.store.getState();
    const mid = Math.floor(Number(movementId));
    const idx = state.stockMovements.findIndex((m) => m.id === mid);
    if (idx < 0) throw new Error("Stok girisi bulunamadi.");
    const movement = state.stockMovements[idx];
    if (movement.type !== "in") throw new Error("Yalnizca stok girisi kaydi silinebilir.");

    const newerForProduct = state.stockMovements.some(
      (m) =>
        m.type === "in" &&
        m.productId === movement.productId &&
        (m.createdAt > movement.createdAt || (m.createdAt === movement.createdAt && m.id > movement.id))
    );
    if (newerForProduct) {
      throw new Error("Once bu urunun daha yeni stok girisini silin.");
    }

    const product = state.products.find((p) => p.id === movement.productId);
    if (!product) throw new Error("Urun bulunamadi.");
    const saleUnit = categorySaleUnitOf(state.categories, product.categoryId);
    const qty = movement.qty;
    if (product.stockQty < qty) {
      throw new Error("Eldeki stok bu giristen az; satis veya sayim sonrasi silinemez.");
    }

    reverseStockAddFifo(state, movement.productId, qty, saleUnit, movement.id);
    product.stockQty -= qty;

    if (movement.cashflowEntryId != null && movement.cashflowEntryId > 0) {
      const before = state.cashflowEntries.length;
      state.cashflowEntries = state.cashflowEntries.filter((e) => e.id !== movement.cashflowEntryId);
      if (state.cashflowEntries.length === before) {
        const byLink = state.cashflowEntries.filter((e) => e.stockMovementId === movement.id);
        if (byLink.length === 1) {
          state.cashflowEntries = state.cashflowEntries.filter((e) => e.stockMovementId !== movement.id);
        }
      }
    }

    const debtAdded = Math.max(0, Math.round(Number(movement.debtAddedKurus) || 0));
    if (debtAdded > 0) {
      const supplierId =
        movement.supplierId != null && movement.supplierId > 0 ? movement.supplierId : product.supplierId;
      const supplier = supplierId > 0 ? state.suppliers.find((s) => s.id === supplierId) : undefined;
      if (!supplier || supplier.balanceOwedKurus < debtAdded) {
        throw new Error("Tedarikci borcu bu girisle uyusmuyor; silinemez.");
      }
      supplier.balanceOwedKurus -= debtAdded;
    }

    state.stockMovements.splice(idx, 1);
    this.store.save();
  }

  listStockEntryLog(limit = 250): StockEntryLogRow[] {
    const state = this.store.getState();
    const nameById = new Map(state.products.map((p) => [p.id, p]));
    return state.stockMovements
      .filter((m) => m.type === "in")
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((m) => {
        const product = nameById.get(m.productId);
        const saleUnit = categorySaleUnitOf(state.categories, product?.categoryId ?? 0);
        const supplierId =
          m.supplierId != null && m.supplierId > 0
            ? m.supplierId
            : product?.supplierId != null && product.supplierId > 0
              ? product.supplierId
              : undefined;
        const cardUnitKurus = Math.max(0, Math.round(Number(product?.costPriceKurus) || 0));
        let unitCostKurus =
          m.unitCostKurus != null && m.unitCostKurus > 0
            ? Math.round(m.unitCostKurus)
            : cardUnitKurus > 0
              ? cardUnitKurus
              : undefined;
        const catalogLineCostKurus =
          m.catalogLineCostKurus != null && m.catalogLineCostKurus > 0
            ? Math.round(m.catalogLineCostKurus)
            : unitCostKurus != null && m.qty > 0
              ? lineCostKurusFromUnit(unitCostKurus, m.qty, saleUnit)
              : undefined;
        let lineCostKurus =
          m.lineCostKurus != null && m.lineCostKurus > 0
            ? Math.round(m.lineCostKurus)
            : m.costMode === "invoice" && m.invoicePaidKurus != null && m.invoicePaidKurus > 0
              ? Math.round(m.invoicePaidKurus)
              : catalogLineCostKurus != null && catalogLineCostKurus > 0
                ? catalogLineCostKurus
                : undefined;
        const supplierName =
          supplierId != null && supplierId > 0
            ? state.suppliers.find((s) => s.id === supplierId)?.name
            : undefined;
        return {
          movementId: m.id,
          createdAt: m.createdAt,
          productId: m.productId,
          productName: product?.name ?? (m.productId === 0 ? "Tedarikci borc odemesi" : "(silinmis urun)"),
          productCode: product?.code ?? "",
          qty: m.qty,
          note: m.note,
          ...(supplierId != null ? { supplierId } : {}),
          ...(supplierName ? { supplierName } : {}),
          ...(unitCostKurus != null ? { unitCostKurus } : {}),
          ...(lineCostKurus != null ? { lineCostKurus } : {}),
          ...(catalogLineCostKurus != null ? { catalogLineCostKurus } : {}),
          ...(m.costMode === "invoice" || m.costMode === "product" ? { costMode: m.costMode } : {}),
          ...(m.invoicePaidKurus != null && m.invoicePaidKurus >= 0 ? { invoicePaidKurus: m.invoicePaidKurus } : {}),
          ...(m.cashflowEntryId != null && m.cashflowEntryId > 0 ? { cashflowEntryId: m.cashflowEntryId } : {}),
          ...(m.amountPaidKurus != null && m.amountPaidKurus >= 0 ? { amountPaidKurus: m.amountPaidKurus } : {}),
          ...(m.debtAddedKurus != null && m.debtAddedKurus > 0 ? { debtAddedKurus: m.debtAddedKurus } : {}),
          ...(m.receiveBatchId?.trim() ? { receiveBatchId: m.receiveBatchId.trim() } : {}),
          saleUnit
        };
      });
  }

  listStockMovementLog(limit = 300): StockMovementLogRow[] {
    const state = this.store.getState();
    const nameById = new Map(state.products.map((p) => [p.id, p]));
    return state.stockMovements
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((m) => {
        const product = nameById.get(m.productId);
        const saleUnit = categorySaleUnitOf(state.categories, product?.categoryId ?? 0);
        return {
          movementId: m.id,
          createdAt: m.createdAt,
          productId: m.productId,
          productName: product?.name ?? (m.productId === 0 ? "Tedarikci borc odemesi" : "(silinmis urun)"),
          productCode: product?.code ?? "",
          type: m.type,
          qty: m.qty,
          note: m.note,
          saleUnit
        };
      });
  }

  /** Gelen stok sepeti icin ortak fatura grubu kimligi */
  nextReceiveBatchId(): string {
    const state = this.store.getState();
    state.sequences.stockReceiveBatchId = Math.max(0, Math.floor(Number(state.sequences.stockReceiveBatchId) || 0)) + 1;
    this.store.save();
    return `SRB-${state.sequences.stockReceiveBatchId}`;
  }

  getSupplierOverview(supplierId: number): SupplierOverview | null {
    const state = this.store.getState();
    const supplier = state.suppliers.find((s) => s.id === supplierId);
    if (!supplier) return null;
    const products = state.products
      .filter((p) => p.isActive === 1 && productHasSupplier(p, supplierId))
      .map((p) => ({
        productId: p.id,
        productName: p.name,
        productCode: p.code,
        stockQty: p.stockQty,
        saleUnit: categorySaleUnitOf(state.categories, p.categoryId)
      }))
      .sort((a, b) => a.productName.localeCompare(b.productName, "tr"));
    const productIds = new Set(products.map((p) => p.productId));
    const stockEntries = this.listStockEntryLog(500).filter((e) => {
      if (e.supplierId != null && e.supplierId > 0) return e.supplierId === supplierId;
      return productIds.has(e.productId);
    });
    return { supplierId, products, stockEntries };
  }

  /** Tedarikci borc odemesi: borcu dusurur, tutari gunluk gidere (Mal alimi / stok) yazar. */
  recordSupplierDebtPayment(
    supplierId: number,
    paymentType: "cash" | "card",
    amountKurus?: number,
    paymentNote?: string
  ): void {
    const state = this.store.getState();
    const sid = Math.floor(Number(supplierId));
    if (!Number.isFinite(sid) || sid <= 0) throw new Error("Tedarikci secilmelidir.");
    const supplier = state.suppliers.find((s) => s.id === sid);
    if (!supplier) throw new Error("Tedarikci bulunamadi.");
    const balance = Math.max(0, Math.round(supplier.balanceOwedKurus));
    if (balance <= 0) throw new Error("Acik borc yok.");
    const pay =
      amountKurus != null && Number.isFinite(Number(amountKurus))
        ? Math.max(0, Math.round(Number(amountKurus)))
        : balance;
    if (pay <= 0) throw new Error("Odeme tutari gecersiz.");
    if (pay > balance) throw new Error("Odeme tutari acik borctan fazla.");
    supplier.balanceOwedKurus = balance - pay;
    state.sequences.stockMovementId += 1;
    const movementId = state.sequences.stockMovementId;
    const payLabel = paymentType === "card" ? "kart" : "nakit";
    const noteTrim = String(paymentNote ?? "").trim();
    const noteExtra = [payLabel, noteTrim].filter(Boolean).join(" · ");
    const cashflowEntryId = this.recordStockPurchaseExpense(state, {
      amountKurus: pay,
      productName: supplier.name,
      qtyLabel: "Tedarikci borc odemesi",
      stockMovementId: movementId,
      noteExtra: noteExtra || payLabel
    });
    const movementNote = ["Tedarikci borc odemesi", payLabel, noteTrim].filter(Boolean).join(" · ");
    state.stockMovements.push({
      id: movementId,
      productId: 0,
      type: "in",
      qty: 0,
      note: movementNote,
      createdAt: new Date().toISOString(),
      supplierId: sid,
      lineCostKurus: pay,
      amountPaidKurus: pay,
      ...(cashflowEntryId != null ? { cashflowEntryId } : {})
    });
    this.store.save();
  }
}
