/** Satis listesi: tarih + saat (TR) */
export function formatSaleDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return d.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

/** Bugunun satislari: yalnizca saat */
export function formatSaleTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(11, 16);
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}
