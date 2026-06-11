import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = join(root, "src/features/account/accountReleaseNotes.ts");
const outPath = join(root, "release-notes.md");

const src = readFileSync(srcPath, "utf8");
const match = src.match(/export const RELEASE_CHANGELOG_MD = `([\s\S]*?)`;/);
if (!match) {
  console.error("RELEASE_CHANGELOG_MD bulunamadi:", srcPath);
  process.exit(1);
}

writeFileSync(outPath, `${match[1].trim()}\n`, "utf8");
console.log("release-notes.md yazildi");
