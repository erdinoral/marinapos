import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "build", "supabase-license.json");

function loadEnvLocal() {
  const filePath = join(root, ".env.local");
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvLocal();

const url = String(process.env.MARINA_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const anonKey = String(
  process.env.MARINA_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
).trim();
/** Musteri .exe: marina-pos. Gelistirme .env.local farkli olabilir — pack icin MARINA_LICENSE_APP_CODE=marina-pos verin. */
const appCode = String(process.env.MARINA_LICENSE_APP_CODE ?? "marina-pos").trim() || "marina-pos";

if (!url || !anonKey) {
  console.error("HATA: Supabase URL veya anon key bos.");
  console.error(`  URL: ${url ? "var" : "YOK"}`);
  console.error(`  ANON: ${anonKey ? "var" : "YOK"}`);
  console.error("GitHub → Settings → Secrets and variables → Actions → Repository secrets");
  console.error("  NEXT_PUBLIC_SUPABASE_URL");
  console.error("  NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(
  outPath,
  `${JSON.stringify({ url, anonKey, appCode, configTable: "pos_license_config", licensesTable: "pos_licenses" }, null, 2)}\n`,
  "utf8"
);
console.log("build/supabase-license.json yazildi (appCode:", appCode + ")");
