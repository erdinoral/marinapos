/**
 * electron-builder afterPack: Windows kurulumundan gereksiz platform / wasm dosyalarini siler.
 */
import fs from "node:fs";
import path from "node:path";

function rm(target) {
  if (!fs.existsSync(target)) return;
  fs.rmSync(target, { recursive: true, force: true });
}

function pruneDir(root, keepRelativePaths) {
  if (!fs.existsSync(root)) return;
  const keep = new Set(keepRelativePaths.map((p) => p.replace(/\\/g, "/")));
  for (const name of fs.readdirSync(root)) {
    const rel = name.replace(/\\/g, "/");
    if (!keep.has(rel)) {
      rm(path.join(root, name));
    }
  }
}

export default async function pruneWinUnpacked(context) {
  if (context.electronPlatformName !== "win32") return;

  const appOut = context.appOutDir;
  const unpacked = path.join(appOut, "resources", "app.asar.unpacked", "node_modules");
  const distWasm = path.join(appOut, "resources", "app.asar.unpacked", "dist", "transformers-wasm");

  rm(distWasm);

  const onnxBin = path.join(unpacked, "onnxruntime-node", "bin", "napi-v3");
  pruneDir(onnxBin, ["win32"]);
  const onnxWin = path.join(onnxBin, "win32");
  pruneDir(onnxWin, ["x64"]);

  const xenovaDist = path.join(unpacked, "@xenova", "transformers", "dist");
  if (fs.existsSync(xenovaDist)) {
    for (const name of fs.readdirSync(xenovaDist)) {
      if (name.endsWith(".wasm") && name !== "ort-wasm-simd.wasm") {
        rm(path.join(xenovaDist, name));
      }
    }
  }

  rm(path.join(unpacked, "sharp"));

  const asarDistWasm = path.join(appOut, "resources", "dist", "transformers-wasm");
  rm(asarDistWasm);

  console.log("[prune-win-unpacked] Platform, sharp ve fazla wasm temizlendi.");
}
