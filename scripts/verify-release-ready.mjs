/**
 * Yayin oncesi kontrol — npm run release:verify
 * pack:release ve tag push oncesi calistirin.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = false;

function fail(msg) {
  console.error(`  HATA: ${msg}`);
  failed = true;
}
function ok(msg) {
  console.log(`  OK: ${msg}`);
}
function warn(msg) {
  console.warn(`  UYARI: ${msg}`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadEnvLocal() {
  const filePath = join(root, ".env.local");
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
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
    out[key] = value;
  }
  return out;
}

console.log("\n=== Marina POS release kontrolu ===\n");

// Surum uyumu
const pkgVersion = readJson(join(root, "package.json")).version;
const notesSrc = readFileSync(join(root, "src/features/account/accountReleaseNotes.ts"), "utf8");
const appVersionMatch = notesSrc.match(/export const APP_VERSION = "([^"]+)"/);
const appVersion = appVersionMatch?.[1] ?? "";
if (pkgVersion !== appVersion) {
  fail(`Surum uyumsuz: package.json=${pkgVersion}, accountReleaseNotes=${appVersion || "?"}`);
} else {
  ok(`Surum ${pkgVersion} (package.json + release notes)`);
}

// Git remote
try {
  const remote = execSync("git remote get-url origin", { cwd: root, encoding: "utf8" }).trim();
  if (!/erdinoral\/marinapos/i.test(remote)) {
    warn(`origin beklenen repo degil: ${remote} (erdinoral/marinapos olmali)`);
  } else {
    ok("Git remote: erdinoral/marinapos");
  }
} catch {
  warn("git remote kontrol edilemedi");
}

// Rapor dosyalari (eski gitignore hatasi)
const reportFiles = [
  "src/features/reports/TableScreen.tsx",
  "src/features/reports/ReportScreen.tsx",
  "src/features/reports/MonthEndReportScreen.tsx",
  "src/features/reports/ReportMonthEndBanner.tsx"
];
for (const f of reportFiles) {
  if (!existsSync(join(root, f))) fail(`Eksik dosya: ${f}`);
}
if (!failed) ok("Rapor modulleri mevcut");

// Supabase lisans yapilandirmasi
const envLocal = loadEnvLocal();
const licensePath = join(root, "build", "supabase-license.json");
let license = null;
if (existsSync(licensePath)) {
  try {
    license = readJson(licensePath);
  } catch {
    fail("build/supabase-license.json gecersiz JSON");
  }
}

const url =
  process.env.MARINA_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  envLocal.NEXT_PUBLIC_SUPABASE_URL ??
  license?.url ??
  "";
const anon =
  process.env.MARINA_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  envLocal.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  license?.anonKey ??
  "";

if (!url || !anon) {
  fail(
    "Supabase lisans yapilandirmasi yok. .env.local veya build/supabase-license.json veya npm run pack:release onceki adim"
  );
} else {
  ok("Supabase URL + anon key bulundu");
}

const appCode =
  process.env.MARINA_LICENSE_APP_CODE ??
  envLocal.MARINA_LICENSE_APP_CODE ??
  license?.appCode ??
  "marina-pos";
if (appCode !== "marina-pos") {
  warn(`app_code="${appCode}" — musteri kurulumu icin marina-pos kullanin (pack:release oncesi MARINA_LICENSE_APP_CODE=marina-pos)`);
} else {
  ok('app_code: marina-pos');
}

// GitHub CI hatirlatmalari
console.log("\n--- CI icin hatirlatma ---");
console.log("  Repository secrets (Environment DEGIL):");
console.log("    NEXT_PUBLIC_SUPABASE_URL");
console.log("    NEXT_PUBLIC_SUPABASE_ANON_KEY");
console.log("  Settings → Actions → Workflow permissions → Read and write");
console.log("  Manuel Run workflow: tag = guncel surum (ornek 1.8.8), v1.8.0 DEGIL");

console.log("\n--- Elle GitHub Release ---");
console.log(`  release/Marina-Nargile-POS-${pkgVersion}-Setup.exe`);
console.log(`  release/Marina-Nargile-POS-${pkgVersion}-Setup.exe.blockmap`);
console.log("  release/latest.yml");

console.log("");
if (failed) {
  console.error("Kontrol BASARISIZ — yayina gecmeyin.\n");
  process.exit(1);
}
console.log("Kontrol gecti — pack:release veya tag push yapabilirsiniz.\n");
