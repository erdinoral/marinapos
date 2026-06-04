import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Gelistirme / vite icin yalnizca tek wasm (SIMD). Kurulum paketine dahil edilmez. */
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const from = path.join(root, "node_modules", "@xenova", "transformers", "dist", "ort-wasm-simd.wasm");
const toDir = path.join(root, "public", "transformers-wasm");
const to = path.join(toDir, "ort-wasm-simd.wasm");

if (!fs.existsSync(from)) {
  console.warn("ort-wasm-simd.wasm bulunamadi, atlaniyor.");
  process.exit(0);
}

fs.mkdirSync(toDir, { recursive: true });
for (const name of fs.readdirSync(toDir)) {
  if (name.endsWith(".wasm") && name !== "ort-wasm-simd.wasm") {
    fs.unlinkSync(path.join(toDir, name));
  }
}
fs.copyFileSync(from, to);
console.log("transformers wasm (simd only) -> public/transformers-wasm");
