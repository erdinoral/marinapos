/** Yerel veya uzak medya yolunu img src icin kullanilabilir URL'ye cevirir. */
export function resolveMediaImageSrc(imagePath: string): string {
  const raw = String(imagePath ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:") || raw.startsWith("file://")) {
    return raw;
  }
  const normalized = raw.replace(/\\/g, "/");
  try {
    if (/^[a-zA-Z]:\//.test(normalized)) {
      return new URL(`file:///${normalized}`).toString();
    }
    if (normalized.startsWith("//")) {
      return new URL(`file:${normalized}`).toString();
    }
    if (normalized.startsWith("/")) {
      return new URL(`file://${normalized}`).toString();
    }
  } catch {
    return encodeURI(`file:///${normalized}`);
  }
  return raw;
}
