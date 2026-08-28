/** Yerel uygulama PIN'i + guvenlik anahtari (cihazda, uyelik zorunlu degil). */

const STORAGE_KEY = "marina-app-pin-v2";
const LEGACY_STORAGE_KEY = "marina-app-pin-v1";
export const LOCAL_PIN_OWNER = "local-device";

const MAX_FAILS = 5;
const LOCKOUT_MS = 30_000;

export type AppPinRecord = {
  ownerId: string;
  saltHex: string;
  hashHex: string;
  recoverySaltHex: string;
  recoveryHashHex: string;
  updatedAt: string;
};

type FailState = {
  count: number;
  lockedUntil: number;
};

const failState: { current: FailState } = { current: { count: 0, lockedUntil: 0 } };

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function randomSalt(bytes = 16): Uint8Array {
  const salt = new Uint8Array(bytes);
  crypto.getRandomValues(salt);
  return salt;
}

export function normalizePin(raw: string): string {
  return String(raw ?? "").replace(/\D/g, "").slice(0, 6);
}

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

export function normalizeRecoveryKey(raw: string): string {
  return String(raw ?? "").trim();
}

export function isValidRecoveryKeyFormat(key: string): boolean {
  return normalizeRecoveryKey(key).length >= 6;
}

async function hashSecret(secret: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 120_000,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );
  return toHex(bits);
}

function readRaw(): unknown | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** v1 (uyelige bagli) kayitlari okunabilir; guvenlik anahtari yoksa sifirlama icin yeniden olusturma gerekir. */
function migrateRecord(parsed: Record<string, unknown>): AppPinRecord | null {
  const saltHex = String(parsed.saltHex ?? "");
  const hashHex = String(parsed.hashHex ?? "");
  if (!saltHex || !hashHex) return null;
  const recoverySaltHex = String(parsed.recoverySaltHex ?? "");
  const recoveryHashHex = String(parsed.recoveryHashHex ?? "");
  return {
    ownerId: String(parsed.ownerId ?? parsed.userId ?? LOCAL_PIN_OWNER),
    saltHex,
    hashHex,
    recoverySaltHex,
    recoveryHashHex,
    updatedAt: String(parsed.updatedAt ?? new Date().toISOString())
  };
}

function readAll(): AppPinRecord | null {
  const parsed = readRaw();
  if (!parsed || typeof parsed !== "object") return null;
  return migrateRecord(parsed as Record<string, unknown>);
}

function writeRecord(rec: AppPinRecord): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

export function getStoredPinRecord(): AppPinRecord | null {
  return readAll();
}

export function hasAppPinConfigured(): boolean {
  const rec = readAll();
  return Boolean(rec?.saltHex && rec.hashHex);
}

/** @deprecated hasAppPinConfigured kullanin */
export function hasPinForUser(_userId?: string): boolean {
  return hasAppPinConfigured();
}

export function hasRecoveryKeyConfigured(): boolean {
  const rec = readAll();
  return Boolean(rec?.recoverySaltHex && rec.recoveryHashHex);
}

export function clearPinStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  failState.current = { count: 0, lockedUntil: 0 };
}

export async function setAppPin(
  pin: string,
  recoveryKey: string,
  _ownerId: string = LOCAL_PIN_OWNER
): Promise<void> {
  const normalized = normalizePin(pin);
  if (!isValidPinFormat(normalized)) {
    throw new Error("PIN 4–6 haneli rakam olmali.");
  }
  const recovery = normalizeRecoveryKey(recoveryKey);
  if (!isValidRecoveryKeyFormat(recovery)) {
    throw new Error("Guvenlik anahtari en az 6 karakter olmali.");
  }
  const salt = randomSalt();
  const recoverySalt = randomSalt();
  const hashHex = await hashSecret(normalized, salt);
  const recoveryHashHex = await hashSecret(recovery.toLowerCase(), recoverySalt);
  writeRecord({
    ownerId: LOCAL_PIN_OWNER,
    saltHex: toHex(salt),
    hashHex,
    recoverySaltHex: toHex(recoverySalt),
    recoveryHashHex,
    updatedAt: new Date().toISOString()
  });
  failState.current = { count: 0, lockedUntil: 0 };
}

/** Mevcut PIN dogrulandiktan sonra yeni PIN (+ istege bagli yeni guvenlik anahtari). */
export async function changeAppPin(
  currentPin: string,
  newPin: string,
  recoveryKey?: string
): Promise<void> {
  const check = await verifyAppPin(currentPin);
  if (check.ok === false) throw new Error(check.message);
  const rec = readAll();
  if (!rec) throw new Error("PIN kaydi bulunamadi.");
  const nextRecovery =
    recoveryKey && isValidRecoveryKeyFormat(recoveryKey)
      ? normalizeRecoveryKey(recoveryKey)
      : null;
  if (nextRecovery) {
    await setAppPin(newPin, nextRecovery);
    return;
  }
  if (!rec.recoverySaltHex || !rec.recoveryHashHex) {
    throw new Error("Guvenlik anahtari zorunlu. Yeni bir guvenlik anahtari da belirleyin.");
  }
  const normalized = normalizePin(newPin);
  if (!isValidPinFormat(normalized)) {
    throw new Error("PIN 4–6 haneli rakam olmali.");
  }
  const salt = randomSalt();
  const hashHex = await hashSecret(normalized, salt);
  writeRecord({
    ...rec,
    ownerId: LOCAL_PIN_OWNER,
    saltHex: toHex(salt),
    hashHex,
    updatedAt: new Date().toISOString()
  });
  failState.current = { count: 0, lockedUntil: 0 };
}

export type VerifyPinResult =
  | { ok: true }
  | { ok: false; reason: "mismatch" | "locked" | "missing"; message: string; retryAfterMs?: number };

export function getPinLockRemainingMs(): number {
  const st = failState.current;
  if (!st.lockedUntil) return 0;
  return Math.max(0, st.lockedUntil - Date.now());
}

function registerFail(): VerifyPinResult {
  const prev = failState.current;
  const count = prev.count + 1;
  if (count >= MAX_FAILS) {
    failState.current = { count: 0, lockedUntil: Date.now() + LOCKOUT_MS };
    return {
      ok: false,
      reason: "locked",
      message: `Cok fazla hatali deneme. ${Math.ceil(LOCKOUT_MS / 1000)} sn bekleyin.`,
      retryAfterMs: LOCKOUT_MS
    };
  }
  failState.current = { count, lockedUntil: 0 };
  return {
    ok: false,
    reason: "mismatch",
    message: `Hatali. Kalan deneme: ${MAX_FAILS - count}`
  };
}

export async function verifyAppPin(pin: string): Promise<VerifyPinResult> {
  const remaining = getPinLockRemainingMs();
  if (remaining > 0) {
    return {
      ok: false,
      reason: "locked",
      message: `Cok fazla hatali deneme. ${Math.ceil(remaining / 1000)} sn bekleyin.`,
      retryAfterMs: remaining
    };
  }

  const rec = readAll();
  if (!rec) {
    return { ok: false, reason: "missing", message: "PIN tanimli degil." };
  }

  const normalized = normalizePin(pin);
  if (!isValidPinFormat(normalized)) {
    return { ok: false, reason: "mismatch", message: "PIN 4–6 haneli rakam olmali." };
  }

  const hashHex = await hashSecret(normalized, fromHex(rec.saltHex));
  if (hashHex !== rec.hashHex) {
    return registerFail();
  }

  failState.current = { count: 0, lockedUntil: 0 };
  return { ok: true };
}

export type VerifyRecoveryResult =
  | { ok: true }
  | { ok: false; reason: "mismatch" | "locked" | "missing"; message: string; retryAfterMs?: number };

export async function verifyRecoveryKey(key: string): Promise<VerifyRecoveryResult> {
  const remaining = getPinLockRemainingMs();
  if (remaining > 0) {
    return {
      ok: false,
      reason: "locked",
      message: `Cok fazla hatali deneme. ${Math.ceil(remaining / 1000)} sn bekleyin.`,
      retryAfterMs: remaining
    };
  }

  const rec = readAll();
  if (!rec?.recoverySaltHex || !rec.recoveryHashHex) {
    return {
      ok: false,
      reason: "missing",
      message:
        "Bu PIN icin guvenlik anahtari kayitli degil. Onceki surumden kaldiysa PIN ile girip Hesap → PIN'den anahtar ekleyin."
    };
  }

  const recovery = normalizeRecoveryKey(key);
  if (!isValidRecoveryKeyFormat(recovery)) {
    return { ok: false, reason: "mismatch", message: "Guvenlik anahtari en az 6 karakter olmali." };
  }

  const hashHex = await hashSecret(recovery.toLowerCase(), fromHex(rec.recoverySaltHex));
  if (hashHex !== rec.recoveryHashHex) {
    const fail = registerFail();
    return fail;
  }

  failState.current = { count: 0, lockedUntil: 0 };
  return { ok: true };
}

/** Guvenlik anahtari dogruysa eski PIN silinir; yeni PIN+anahtar olusturulmali. */
export async function resetPinWithRecoveryKey(key: string): Promise<void> {
  const check = await verifyRecoveryKey(key);
  if (check.ok === false) throw new Error(check.message);
  clearPinStorage();
}
