import { formatTry, parseTrAmount, tlToKurus } from "./currency";

/**
 * Acik borc elle silinince / degistirilince uyari.
 * previousKurus > 0 ve yeni tutar farkliysa confirm ister; iptalde false.
 */
export function confirmDebtBalanceEdit(previousKurus: number, nextKurus: number): boolean {
  const prev = Math.max(0, Math.round(Number(previousKurus) || 0));
  const next = Math.max(0, Math.round(Number(nextKurus) || 0));
  if (prev <= 0) return true;
  if (prev === next) return true;

  if (next <= 0) {
    return window.confirm(
      `Acik borc (${formatTry(prev)}) silinecek / sifirlanacak.\n\n` +
        `Yanlislikla silmeyin. Tahsilat icin "Borc odendi" / odeme panelini kullanin.\n\n` +
        `Devam edilsin mi?`
    );
  }

  return window.confirm(
    `Acik borc ${formatTry(prev)} → ${formatTry(next)} olarak degistirilecek.\n\n` +
      `Emin misiniz?`
  );
}

/** Formdaki TL metninden kurus; gecersizse 0 */
export function balanceTlToKurus(raw: string): number {
  const n = parseTrAmount(String(raw ?? "").trim());
  if (n == null || n < 0) return 0;
  return tlToKurus(n);
}

/** Uncontrolled input blur: onay yoksa eski degeri geri yazar */
export function applyDebtBalanceBlur(
  input: HTMLInputElement,
  previousKurus: number,
  onConfirm: (nextKurus: number) => void
): void {
  const nextKurus = balanceTlToKurus(input.value);
  if (!confirmDebtBalanceEdit(previousKurus, nextKurus)) {
    input.value = previousKurus > 0 ? String(previousKurus / 100) : "";
    return;
  }
  onConfirm(nextKurus);
}
