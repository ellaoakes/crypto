/** Pure date helpers shared between the onboarding UI and server actions. */

/** "YYYY-MM" -> the calendar month's first and last day (UTC). */
export function monthKeyToRange(monthKey: string): { start: Date; end: Date } {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0));
  return { start, end };
}

/** The next `count` calendar months as "YYYY-MM" keys, starting this month. */
export function nextMonthKeys(count: number, from: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

export function monthKeyLabel(monthKey: string): string {
  const { start } = monthKeyToRange(monthKey);
  return start.toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
