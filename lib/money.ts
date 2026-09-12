/** Format an integer pence amount as "£12.34" (or "£12" when it's a whole pound). */
export function formatPence(pence: number): string {
  const pounds = pence / 100;
  const isWhole = Number.isInteger(pounds);
  return `£${pounds.toLocaleString("en-GB", {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function poundsToPence(pounds: number): number {
  return Math.round(pounds * 100);
}
