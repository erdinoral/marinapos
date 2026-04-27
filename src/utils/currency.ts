export function tlToKurus(amountTl: number): number {
  return Math.round((Number.isFinite(amountTl) ? amountTl : 0) * 100);
}

export function kurusToTl(amountKurus: number): number {
  return (Number.isFinite(amountKurus) ? amountKurus : 0) / 100;
}

export function formatTry(amountKurus: number): string {
  return `${kurusToTl(amountKurus).toFixed(2)} TL`;
}
