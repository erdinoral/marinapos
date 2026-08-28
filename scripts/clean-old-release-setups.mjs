/**
 * release/ icinde sadece mevcut package.json surumunun Setup + blockmap kalsin.
 * Eski Marina-Nargile-POS-*-Setup.exe / .blockmap silinir.
 */
import { existsSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = join(root, "release");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const keepExact = new Set([
  `Marina-Nargile-POS-${version}-Setup.exe`,
  `Marina-Nargile-POS-${version}-Setup.exe.blockmap`
]);

if (!existsSync(releaseDir)) {
  console.log("release/ yok — atlandi");
  process.exit(0);
}

let removed = 0;
for (const name of readdirSync(releaseDir)) {
  const isSetup =
    /^Marina-Nargile-POS-.+-Setup\.exe$/i.test(name) ||
    /^Marina-Nargile-POS-.+-Setup\.exe\.blockmap$/i.test(name);
  if (!isSetup) continue;
  if (keepExact.has(name)) continue;
  unlinkSync(join(releaseDir, name));
  console.log(`  silindi: ${name}`);
  removed++;
}

console.log(
  removed === 0
    ? `Eski Setup yok — sadece ${version} (veya henuz olusmadi)`
    : `Eski Setup temizlendi (${removed}). Kalan: ${version}`
);
