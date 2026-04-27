import { contextBridge, ipcRenderer } from "electron";
import { PaymentType, ProductInput, SaleKind } from "../src/types/models";

contextBridge.exposeInMainWorld("marinaApi", {
  listProducts: () => ipcRenderer.invoke("products:list"),
  listCategories: () => ipcRenderer.invoke("categories:list"),
  createCategory: (name: string) => ipcRenderer.invoke("categories:create", name),
  createProduct: (payload: ProductInput) => ipcRenderer.invoke("products:create", payload),
  addStock: (productId: number, quantity: number) => ipcRenderer.invoke("products:add-stock", productId, quantity),
  adjustStock: (productId: number, countedQty: number, note = "") =>
    ipcRenderer.invoke("products:adjust-stock", productId, countedQty, note),
  lowStock: () => ipcRenderer.invoke("products:low-stock"),
  getStockEntryLog: () => ipcRenderer.invoke("products:stock-entry-log"),
  selectImage: () => ipcRenderer.invoke("media:select-image"),
  createSale: (
    items: Array<{ productId: number; qty: number }>,
    paymentType: PaymentType,
    paidAmount: number,
    kind: SaleKind = "sale"
  ) => ipcRenderer.invoke("sales:create", items, paymentType, paidAmount, kind),
  getDailySales: (date: string) => ipcRenderer.invoke("sales:daily", date),
  getDayProfitDetail: (date: string) => ipcRenderer.invoke("profit:day-detail", date),
  getStockAging: () => ipcRenderer.invoke("stock:aging"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setOpeningTime: (openingTime: string) => ipcRenderer.invoke("settings:set-opening-time", openingTime),
  setClosureTime: (closureTime: string) => ipcRenderer.invoke("settings:set-closure-time", closureTime),
  setOpeningCash: (amountKurus: number) => ipcRenderer.invoke("settings:set-opening-cash", amountKurus),
  runClosure: (actualCashKurus?: number) => ipcRenderer.invoke("closures:run", actualCashKurus),
  showItemInFolder: (fullPath: string) => ipcRenderer.invoke("shell:show-item-in-folder", fullPath),
  exportXlsx: (date: string) => ipcRenderer.invoke("export:xlsx", date),
  exportMonthlyProfitXlsx: (yearMonth: string) => ipcRenderer.invoke("export:monthly-profit", yearMonth)
});
