import fs from "node:fs";
import path from "node:path";

export type ErrorLogLevel = "error" | "warn" | "info";

export interface ErrorLogEntry {
  id: string;
  createdAt: string;
  level: ErrorLogLevel;
  message: string;
}

export class ErrorLogService {
  private filePath: string;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.filePath = path.join(dataDir, "error-logs.json");
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), "utf-8");
    }
  }

  add(level: ErrorLogLevel, message: string) {
    const rows = this.list(500);
    const row: ErrorLogEntry = {
      id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      createdAt: new Date().toISOString(),
      level,
      message: message.trim().slice(0, 2000)
    };
    rows.unshift(row);
    const keep = rows.slice(0, 500);
    fs.writeFileSync(this.filePath, JSON.stringify(keep, null, 2), "utf-8");
  }

  list(limit = 200): ErrorLogEntry[] {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf-8")) as ErrorLogEntry[];
      return (parsed ?? []).slice(0, Math.max(1, limit));
    } catch {
      return [];
    }
  }

  clear() {
    fs.writeFileSync(this.filePath, JSON.stringify([], null, 2), "utf-8");
  }
}
