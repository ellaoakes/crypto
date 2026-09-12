import type { DateRange } from "@/lib/matching";

/** "14–17 May 2027" or, across a month boundary, "30 Apr – 3 May 2027". */
export function formatDateRangeWithYear(range: DateRange): string {
  const start = new Date(`${range.start}T00:00:00Z`);
  const end = new Date(`${range.end}T00:00:00Z`);
  const startMonth = start.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
  const endMonth = end.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
  const year = end.toLocaleDateString("en-GB", { year: "numeric", timeZone: "UTC" });

  if (startMonth === endMonth) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${endMonth} ${year}`;
  }
  return `${start.getUTCDate()} ${startMonth} – ${end.getUTCDate()} ${endMonth} ${year}`;
}

/** "£650–£820 pp" */
export function formatCostPerPersonRange(range: { min: number; max: number }): string {
  return `£${range.min.toLocaleString("en-GB")}–£${range.max.toLocaleString("en-GB")} pp`;
}

/** "~2.6h flight" when the range is effectively a single value, else "2.6–3.1h flight". */
export function formatFlightHoursRange(range: { min: number; max: number }): string {
  const format = (hours: number) => `${hours.toFixed(1)}h`;
  if (Math.abs(range.max - range.min) < 0.05) {
    return `~${format(range.min)} flight`;
  }
  return `${format(range.min)}–${format(range.max)} flight`;
}
