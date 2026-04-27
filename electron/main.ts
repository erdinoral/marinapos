import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import { DatabaseService } from "../src/db/databaseService";
import { ClosureService } from "../src/features/closure/ClosureService";
import { exportMonthlyProfitToXlsx, exportSalesToXlsx } from "../src/services/exportService";
import { PaymentType, ProductInput, SaleKind } from "../src/types/models";

const isDev = !app.isPackaged;
const projectDataDir = path.join(process.cwd(), "data");
const database = new DatabaseService(projectDataDir, app.getPath("userData"));
const closureService = new ClosureService(database, (result) => {
  console.log(`Kapanis tamamlandi: ${result.reportPath}`);
  app.quit();
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1500,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true
    }
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  database.init();
  closureService.startScheduler();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("products:list", () => database.products.list());
ipcMain.handle("categories:list", () => database.products.listCategories());
ipcMain.handle("categories:create", (_, name: string) => database.products.createCategory(name));
ipcMain.handle("products:create", (_, payload: ProductInput) => database.products.create(payload));
ipcMain.handle("products:add-stock", (_, productId: number, quantity: number) =>
  database.products.addStock(productId, quantity)
);
ipcMain.handle("products:adjust-stock", (_, productId: number, countedQty: number, note = "") =>
  database.products.adjustStock(productId, countedQty, note)
);
ipcMain.handle("products:low-stock", () => database.products.lowStock());
ipcMain.handle("products:stock-entry-log", () => database.products.listStockEntryLog());
ipcMain.handle("media:select-image", async () => {
  const result = await dialog.showOpenDialog({
    title: "Urun resmi sec",
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }]
  });
  if (result.canceled || result.filePaths.length === 0) return "";
  return result.filePaths[0];
});
ipcMain.handle(
  "sales:create",
  (_, items: Array<{ productId: number; qty: number }>, paymentType: PaymentType, paidAmount: number, kind: SaleKind = "sale") =>
    database.sales.create(items, paymentType, paidAmount, kind)
);
ipcMain.handle("sales:daily", (_, date: string) => database.sales.getByDate(date));
ipcMain.handle("profit:day-detail", (_, date: string) => database.sales.getProfitDetailForDate(date));
ipcMain.handle("stock:aging", () => database.sales.getStockAging());
ipcMain.handle("settings:get", () => database.settings.get());
ipcMain.handle("settings:set-opening-time", (_, openingTime: string) => database.settings.setOpeningTime(openingTime));
ipcMain.handle("settings:set-closure-time", (_, closureTime: string) => database.settings.setClosureTime(closureTime));
ipcMain.handle("settings:set-opening-cash", (_, amountKurus: number) => database.settings.setOpeningCash(amountKurus));
ipcMain.handle("closures:run", (_, actualCashKurus?: number) => closureService.runClosureForToday(actualCashKurus));
ipcMain.handle("shell:show-item-in-folder", (_, fullPath: string) => {
  if (fullPath) shell.showItemInFolder(path.normalize(fullPath));
});
ipcMain.handle("export:xlsx", (_, date: string) => exportSalesToXlsx(database, date, app.getPath("documents")));
ipcMain.handle("export:monthly-profit", (_, yearMonth: string) =>
  exportMonthlyProfitToXlsx(database, yearMonth, app.getPath("documents"))
);
