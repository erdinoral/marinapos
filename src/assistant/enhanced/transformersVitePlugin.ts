import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/** Vite: transformers onnx backend + wasm dosyalari (Electron uyumu). */
export function transformersBrowserPlugin(rootDir: string): Plugin {
  const onnxReplacement = path.resolve(rootDir, "src/assistant/enhanced/onnx-backend-browser.js");
  const wasmSrc = path.join(rootDir, "node_modules", "@xenova", "transformers", "dist");
  const wasmDest = path.join(rootDir, "public", "transformers-wasm");

  function copyWasmFiles() {
    if (!fs.existsSync(wasmSrc)) return;
    fs.mkdirSync(wasmDest, { recursive: true });
    for (const name of fs.readdirSync(wasmSrc)) {
      if (name.endsWith(".wasm")) {
        fs.copyFileSync(path.join(wasmSrc, name), path.join(wasmDest, name));
      }
    }
  }

  return {
    name: "marina-transformers-browser",
    config() {
      copyWasmFiles();
    },
    resolveId(source, importer) {
      const imp = (importer ?? "").replace(/\\/g, "/");
      if (!imp.includes("@xenova/transformers")) return null;
      if (source === "./backends/onnx.js" || source.endsWith("/backends/onnx.js")) {
        return onnxReplacement;
      }
      return null;
    }
  };
}
