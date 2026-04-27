import { execFileSync } from "node:child_process";
import type { IncomingMessage } from "node:http";
import path from "node:path";
import type { Plugin } from "vite";
import { DatabaseService } from "./src/db/databaseService";
import { ClosureService } from "./src/features/closure/ClosureService";
import { exportMonthlyProfitToXlsx, exportSalesToXlsx } from "./src/services/exportService";
import type { PaymentType, ProductInput } from "./src/types/models";

function showItemInFolderDev(fullPath: string) {
  if (!fullPath) return;
  const normalized = path.normalize(fullPath);
  try {
    if (process.platform === "win32") {
      execFileSync("explorer.exe", ["/select,", normalized], { windowsHide: true });
    } else if (process.platform === "darwin") {
      execFileSync("open", ["-R", normalized]);
    } else {
      execFileSync("xdg-open", [path.dirname(normalized)]);
    }
  } catch {
    /* explorer acilmazsa sessiz */
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (ch) => chunks.push(ch as Buffer));
    req.on("end", () => resolve(chunks.length ? Buffer.concat(chunks).toString("utf-8") : ""));
    req.on("error", reject);
  });
}

function dispatch(db: DatabaseService, channel: string, args: unknown[]): unknown {
  switch (channel) {
    case "products:list":
      return db.products.list();
    case "categories:list":
      return db.products.listCategories();
    case "categories:create":
      return db.products.createCategory(String(args[0] ?? ""));
    case "products:create":
      return db.products.create(args[0] as ProductInput);
    case "products:add-stock":
      return db.products.addStock(Number(args[0]), Number(args[1]));
    case "products:low-stock":
      return db.products.lowStock();
    case "media:select-image":
      return "";
    case "sales:create":
      return db.sales.create(
        args[0] as Array<{ productId: number; qty: number }>,
        args[1] as PaymentType,
        Number(args[2])
      );
    case "sales:daily":
      return db.sales.getByDate(String(args[0] ?? ""));
    case "profit:day-detail":
      return db.sales.getProfitDetailForDate(String(args[0] ?? ""));
    case "settings:get":
      return db.settings.get();
    case "settings:set-closure-time":
      return db.settings.setClosureTime(String(args[0] ?? ""));
    case "closures:run":
      return new ClosureService(db).runClosureForToday();
    case "shell:show-item-in-folder":
      showItemInFolderDev(String(args[0] ?? ""));
      return null;
    case "export:xlsx":
      return exportSalesToXlsx(db, String(args[0] ?? ""), path.join(process.cwd(), "exports"));
    case "export:monthly-profit":
      return exportMonthlyProfitToXlsx(db, String(args[0] ?? ""), path.join(process.cwd(), "exports"));
    default:
      throw new Error(`Bilinmeyen kanal: ${channel}`);
  }
}

export function marinaDevIpcPlugin(): Plugin {
  return {
    name: "marina-dev-ipc",
    configureServer(server) {
      const dataDir = path.join(process.cwd(), "data");
      const database = new DatabaseService(dataDir);
      database.init();

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith("/__marina/ipc")) {
          return next();
        }
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }
        try {
          const raw = await readBody(req);
          const { channel, args } = JSON.parse(raw || "{}") as { channel?: string; args?: unknown[] };
          if (!channel) {
            res.statusCode = 400;
            res.end("channel gerekli");
            return;
          }
          const result = dispatch(database, channel, Array.isArray(args) ? args : []);
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(result === undefined ? null : result));
        } catch (e) {
          res.statusCode = 500;
          res.end(e instanceof Error ? e.message : "IPC hatasi");
        }
      });
    }
  };
}
