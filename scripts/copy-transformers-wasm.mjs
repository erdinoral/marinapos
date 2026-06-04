import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const from = path.join(root, "node_modules", "@xenova", "transformers", "dist");
const to = path.join(root, "public", "transformers-wasm");

fs.mkdirSync(to, { recursive: true });
for (const name of fs.readdirSync(from)) {
  if (name.endsWith(".wasm")) {
    fs.copyFileSync(path.join(from, name), path.join(to, name));
  }
}
console.log("transformers wasm -> public/transformers-wasm");
