import fs from "node:fs";
import path from "node:path";

/** .env.local icindeki bu anahtarlar dosyadaki degerle guncellenir (dev lisans kodu icin). */
const OVERRIDE_KEYS = new Set([
  "MARINA_LICENSE_APP_CODE",
  "MARINA_LICENSE_URL",
  "MARINA_SUPABASE_URL",
  "MARINA_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "MARINA_SKIP_LICENSE"
]);

function applyEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
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
    if (OVERRIDE_KEYS.has(key) || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/** Gelistirmede .env.local okur (gitignore'da). Birden fazla klasor denenebilir. */
export function loadEnvLocal(cwd: string | string[] = process.cwd()) {
  const dirs = Array.isArray(cwd) ? cwd : [cwd];
  for (const dir of dirs) {
    applyEnvFile(path.join(dir, ".env.local"));
  }
}
