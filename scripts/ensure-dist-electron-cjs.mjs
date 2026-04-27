import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "dist-electron");
const marker = join(outDir, "package.json");

mkdirSync(outDir, { recursive: true });
writeFileSync(marker, JSON.stringify({ type: "commonjs" }, null, 2), "utf-8");
