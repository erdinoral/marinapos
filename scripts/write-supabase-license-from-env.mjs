import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "build", "supabase-license.json");

const url = String(process.env.MARINA_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const anonKey = String(
  process.env.MARINA_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
).trim();
const appCode = String(process.env.MARINA_LICENSE_APP_CODE ?? "marina-pos").trim() || "marina-pos";

if (!url || !anonKey) {
  console.error(
    "HATA: CI icin MARINA_SUPABASE_URL ve MARINA_SUPABASE_ANON_KEY GitHub Secrets olarak tanimli olmali."
  );
  process.exit(1);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(
  outPath,
  `${JSON.stringify({ url, anonKey, appCode, configTable: "pos_license_config", licensesTable: "pos_licenses" }, null, 2)}\n`,
  "utf8"
);
console.log("build/supabase-license.json yazildi (appCode:", appCode + ")");
